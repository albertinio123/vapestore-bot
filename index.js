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

// === KONFIGŪRACIJA ===
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) throw new Error("BOT_TOKEN nėra nustatytas! Eik į Vercel → Settings → Environment Variables");

const PORT = process.env.PORT || 3000;
const URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`;
const ADMIN_ID = 112336357;
const ADMIN_PANEL_URL = `${URL}/admin`;

// === KREPŠELIS (laikinas, per atmintį) ===
const carts = {}; // { userId: { products: [], total: 0 } }

// === PRODUKTAI ===
let products = {};
const productsPath = join(__dirname, "products.json");

function loadProducts() {
  try {
    products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
    console.log("Produktai įkelti:", Object.keys(products).length, "brendai");
  } catch {
    console.log("products.json nerastas – pradedam tuščiai");
    products = {};
  }
}
loadProducts();

const bot = new TelegramBot(TOKEN);

// === WEBHOOK NUSTATYMAS (automatinis paleidus serverį) ===
async function setupWebhook() {
  const webhookUrl = `${URL}/api/bot`;
  try {
    const info = await bot.getWebHookInfo();
    if (info.url !== webhookUrl) {
      await bot.setWebHook(webhookUrl);
      console.log("Webhook nustatytas:", webhookUrl);
    } else {
      console.log("Webhook jau veikia:", webhookUrl);
    }
  } catch (err) {
    console.error("Webhook klaida:", err.message);
  }
}

// === MARŠRUTAI ===
app.post("/api/bot", (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send(`VapeStore botas veikia! <a href="/admin">Admin panelė</a>`);
});

app.get("/admin", (req, res) => {
  res.sendFile(join(__dirname, "public", "admin.html"));
});

app.get("/api/products", (req, res) => {
  res.json(products);
});

app.post("/api/products", (req, res) => {
  const { brand, name, description, photo_url, price } = req.body;
  if (!brand || !name || !description) {
    return res.status(400).json({ error: "Trūksta duomenų" });
  }
  if (!products[brand]) products[brand] = [];
  products[brand].push({ name, description, photo_url, price: price || 5 });
  try {
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
  } catch (err) {
    console.log("Nepavyko išsaugoti (Vercel tik skaitymui)");
  }
  res.json({ success: true });
});

// === BOT KOMANDOS ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Sveikas atvykęs į *VapeStore*!", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "Skysčiai", callback_data: "list_brands" }]]
    }
  });
});

bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "Prieiga draudžiama.");
  }
  bot.sendMessage(msg.chat.id, `Admin panelė: ${ADMIN_PANEL_URL}`);
});

bot.onText(/\/cart/, (msg) => {
  const userId = msg.from.id;
  const cart = carts[userId] || { products: [], total: 0 };
  if (cart.products.length === 0) {
    return bot.sendMessage(userId, "Tavo krepšelis tuščias. Pridėk produktus!");
  }
  let text = `*Tavo krepšelis:*\n\n`;
  cart.products.forEach(p => {
    text += `${p.name} – ${p.price} €\n`;
  });
  text += `\nIš viso: *${cart.total} €*`;
  bot.sendMessage(userId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Užsakyti", callback_data: `order_${cart.total}` }],
        [{ text: "Ištrinti viską", callback_data: "clear_cart" }]
      ]
    }
  });
});

// === CALLBACK QUERIES ===
bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;
  const data = q.data;

  // Brendų sąrašas
  if (data === "list_brands") {
    const brands = Object.keys(products);
    if (brands.length === 0) return bot.sendMessage(chatId, "Nėra prekių");
    const keyboard = brands.map(b => [{ text: b, callback_data: `brand_${b}` }]);
    bot.sendMessage(chatId, "Pasirink brendą:", { reply_markup: { inline_keyboard: keyboard } });
  }

  // Skonių sąrašas
  if (data.startsWith("brand_")) {
    const brand = data.slice(6);
    const items = products[brand] || [];
    if (items.length === 0) return bot.sendMessage(chatId, `Nėra skonių iš *${brand}*`, { parse_mode: "Markdown" });
    const keyboard = items.map(i => [{ text: i.name, callback_data: `flavor_${brand}_${i.name}` }]);
    bot.sendMessage(chatId, `Skoniai iš *${brand}*:`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // Produkto peržiūra su nuotrauka
  if (data.startsWith("flavor_")) {
    const parts = data.split("_"). |slice(1);
    const brand = parts[0];
    const name = parts.slice(1).join(" ");
    const item = (products[brand] || []).find(i => i.name === name);
    if (!item) return bot.sendMessage(chatId, "Skonis nerastas");

    const keyboard = [
      [{ text: "Į krepšelį", callback_data: `add_to_cart_${brand}_${name}` }],
      [{ text: "Peržiūrėti krepšelį", callback_data: "show_cart" }]
    ];

    await bot.sendPhoto(chatId, item.photo_url, {
      caption: `*${item.name}*\n\n${item.description}\n\nKaina: *${item.price} €*`,
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // Pridėti į krepšelį
  if (data.startsWith("add_to_cart_")) {
    const parts = data.split("_").slice(2);
    const brand = parts[0];
    const name = parts.slice(1).join(" ");
    const item = (products[brand] || []).find(i => i.name === name);
    if (!item) return;

    if (!carts[userId]) carts[userId] = { products: [], total: 0 };
    carts[userId].products.push(item);
    carts[userId].total += item.price;

    bot.sendMessage(chatId, `*${item.name}* pridėtas į krepšelį!\nIš viso: *${carts[userId].total} €*`, {
      parse_mode: "Markdown"
    });
  }

  // Peržiūrėti krepšelį
  if (data === "show_cart") {
    bot.sendMessage(chatId, "Peržiūrėk krepšelį: /cart");
  }

  // Siųsti užsakymą adminui
  if (data.startsWith("order_")) {
    const total = parseInt(data.split("_")[1]);
    const order = carts[userId]?.products || [];
    let orderText = `NAUJAS UŽSAKYMAS:\n\n`;
    order.forEach(p => orderText += `${p.name} – ${p.price} €\n`);
    orderText += `\nIš viso: ${total} €\nVartotojas: @${q.from.username || userId}`;
    bot.sendMessage(ADMIN_ID, orderText);
    bot.sendMessage(chatId, "Užsakymas išsiųstas adminui! Atsakysime per 1 val.");
    delete carts[userId];
  }

  // Išvalyti krepšelį
  if (data === "clear_cart") {
    delete carts[userId];
    bot.sendMessage(chatId, "Krepšelis išvalytas!");
  }

  bot.answerCallbackQuery(q.id);
});

// === PALEIDIMAS ===
app.listen(PORT, () => {
  console.log(`Serveris veikia: ${URL}`);
  console.log(`Admin panelė: ${ADMIN_PANEL_URL}`);
  setupWebhook();
});
