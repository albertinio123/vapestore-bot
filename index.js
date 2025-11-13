import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, "public")));

// === BOT TOKEN ===
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error("FATAL: BOT_TOKEN nerastas! Eik į Vercel → Settings → Environment Variables");
  process.exit(1);
}
console.log("BOT_TOKEN rastas:", TOKEN.substring(0, 10) + "...");

const PORT = process.env.PORT || 3000;
const URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`;
const ADMIN_ID = 112336357;

const carts = {};
let products = {};
const productsPath = join(__dirname, "products.json");

function loadProducts() {
  try {
    const data = fs.readFileSync(productsPath, "utf8");
    products = JSON.parse(data);
    console.log("Produktai įkelti:", Object.keys(products).length, "brendai");
  } catch (err) {
    console.log("products.json nerastas – pradedam tuščiai");
    products = {};
  }
}
loadProducts();

const bot = new TelegramBot(TOKEN);

// === WEBHOOK NUSTATYMAS ===
async function setupWebhook() {
  const webhookUrl = `${URL}/api/bot`;
  try {
    await bot.setWebHook(webhookUrl);
    console.log("WEBHOOK NUSTATYTAS:", webhookUrl);
  } catch (err) {
    console.error("WEBHOOK KLAIDA:", err.message);
  }
}

// === MARŠRUTAI ===
app.post("/api/bot", (req, res) => {
  console.log("GAUTAS UPDATE IŠ TELEGRAM:", JSON.stringify(req.body).substring(0, 200));
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send(`VapeStore botas veikia! <a href="/admin">Admin</a>`);
});

app.get("/admin", (req, res) => {
  res.sendFile(join(__dirname, "public", "admin.html"));
});

app.get("/api/products", (req, res) => {
  res.json(products);
});

app.post("/api/products", (req, res) => {
  const { brand, name, description, photo_url, price } = req.body;
  if (!brand || !name || !description) return res.status(400).json({ error: "Trūksta duomenų" });
  if (!products[brand]) products[brand] = [];
  products[brand].push({ name, description, photo_url, price: price || 5 });
  try { fs.writeFileSync(productsPath, JSON.stringify(products, null, 2)); } catch {}
  res.json({ success: true });
});

// === BOT KOMANDOS ===
bot.on("message", (msg) => {
  console.log("GAUTA ŽINUTĖ:", msg.text, "iš", msg.from.id);
});

bot.onText(/\/start/, (msg) => {
  console.log("/start iš", msg.from.id);
  bot.sendMessage(msg.chat.id, "Sveikas atvykęs į *VapeStore*!", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "Skysčiai", callback_data: "list_brands" }]]
    }
  }).catch(err => console.error("NEPAVYKO IŠSIŲSTI:", err.message));
});

bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "Drausta.");
  bot.sendMessage(msg.chat.id, `Admin: ${URL}/admin`);
});

bot.onText(/\/cart/, (msg) => {
  const userId = msg.from.id;
  const cart = carts[userId] || { products: [], total: 0 };
  if (cart.products.length === 0) return bot.sendMessage(userId, "Krepšelis tuščias!");
  let text = `*Krepšelis:*\n\n`;
  cart.products.forEach(p => text += `${p.name} – ${p.price} €\n`);
  text += `\nIš viso: *${cart.total} €*`;
  bot.sendMessage(userId, text, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "Užsakyti", callback_data: `order_${cart.total}` }]] }
  });
});

bot.on("callback_query", async (q) => {
  console.log("CALLBACK:", q.data);
  const chatId = q.message.chat.id;
  const userId = q.from.id;
  const data = q.data;

  if (data === "list_brands") {
    const brands = Object.keys(products);
    if (brands.length === 0) return bot.sendMessage(chatId, "Nėra prekių");
    const keyboard = brands.map(b => [{ text: b, callback_data: `brand_${b}` }]);
    bot.sendMessage(chatId, "Pasirink brendą:", { reply_markup: { inline_keyboard: keyboard } });
  }

  if (data.startsWith("brand_")) {
    const brand = data.slice(6);
    const items = products[brand] || [];
    const keyboard = items.map(i => [{ text: i.name, callback_data: `flavor_${brand}_${i.name}` }]);
    bot.sendMessage(chatId, `Skoniai iš *${brand}*:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
  }

  if (data.startsWith("flavor_")) {
    const parts = data.split("_").slice(1);
    const brand = parts[0];
    const name = parts.slice(1).join(" ");
    const item = (products[brand] || []).find(i => i.name === name);
    if (!item) return;

    await bot.sendPhoto(chatId, item.photo_url, {
      caption: `*${item.name}*\n\n${item.description}\n\nKaina: *${item.price} €*`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "Į krepšelį", callback_data: `add_${brand}_${name}` }]] }
    });
  }

  if (data.startsWith("add_")) {
    const parts = data.split("_").slice(1);
    const brand = parts[0];
    const name = parts.slice(1).join(" ");
    const item = (products[brand] || []).find(i => i.name === name);
    if (!item) return;

    if (!carts[userId]) carts[userId] = { products: [], total: 0 };
    carts[userId].products.push(item);
    carts[userId].total += item.price;

    bot.sendMessage(chatId, `Pridėta: *${item.name}* | Iš viso: ${carts[userId].total} €`, { parse_mode: "Markdown" });
  }

  if (data.startsWith("order_")) {
    const total = parseInt(data.split("_")[1]);
    const order = carts[userId]?.products || [];
    let text = `UŽSAKYMAS:\n\n`;
    order.forEach(p => text += `${p.name} – ${p.price} €\n`);
    text += `\nIš viso: ${total} €\nVartotojas: ${userId}`;
    bot.sendMessage(ADMIN_ID, text);
    bot.sendMessage(chatId, "Užsakymas išsiųstas!");
    delete carts[userId];
  }

  bot.answerCallbackQuery(q.id);
});

// === PALEIDIMAS ===
app.listen(PORT, async () => {
  console.log(`SERVERIS VEIKIA: ${URL}`);
  console.log(`ADMIN PANELĖ: ${URL}/admin`);
  await setupWebhook();
});
