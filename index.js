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

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) throw new Error("BOT_TOKEN nėra!");

const PORT = process.env.PORT || 3000;
const URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : `http://localhost:${PORT}`;
const ADMIN_ID = 123456789; // <--- ČIA ĮRAŠYK SAVO ID IŠ @userinfobot
const ADMIN_PANEL_URL = `${URL}/admin`;

let products = {};
const productsPath = join(__dirname, "products.json");

function loadProducts() {
  try {
    products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
    console.log("Produktai įkelti");
  } catch {
    products = {};
  }
}
loadProducts();

const bot = new TelegramBot(TOKEN);

async function setupWebhook() {
  const webhookUrl = `${URL}/webhook/${TOKEN}`;
  try {
    const info = await bot.getWebHookInfo();
    if (info.url !== webhookUrl) await bot.setWebHook(webhookUrl);
    console.log("Webhook:", webhookUrl);
  } catch (err) {
    console.error("Webhook klaida:", err.message);
  }
}

app.post(`/webhook/${TOKEN}`, (req, res) => {
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
  const { brand, name, description } = req.body;
  if (!brand || !name || !description) return res.status(400).json({ error: "Trūksta" });

  if (!products[brand]) products[brand] = [];
  products[brand].push({ name, description });

  try { fs.writeFileSync(productsPath, JSON.stringify(products, null, 2)); } catch {}
  res.json({ success: true });
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Sveikas atvykęs į *VapeStore*!", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "Skysčiai", callback_data: "list_brands" }]] }
  });
});

bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.chat.id, "Draudžiama.");
  bot.sendMessage(msg.chat.id, `Admin panelė: ${ADMIN_PANEL_URL}`);
});

bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  data = q.data;

  if (data === "list_brands") {
    const brands = Object.keys(products);
    if (!brands.length) return bot.sendMessage(chatId, "Nėra prekių");
    const keyboard = brands.map(b => [{ text: b, callback_data: `brand_${b}` }]);
    bot.sendMessage(chatId, "Pasirink brendą:", { reply_markup: { inline_keyboard: keyboard } });
  }

  if (data.startsWith("brand_")) {
    const brand = data.slice(6);
    const items = products[brand] || [];
    if (!items.length) return bot.sendMessage(chatId, `Nėra skonių iš *${brand}*`, { parse_mode: "Markdown" });
    const keyboard = items.map(i => [{ text: i.name, callback_data: `flavor_${brand}_${i.name}` }]);
    bot.sendMessage(chatId, `Skoniai iš *${brand}*:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } });
  }

  if (data.startsWith("flavor_")) {
    const parts = data.split("_").slice(1);
    const brand = parts[0];
    const name = parts.slice(1).join(" ");
    const item = (products[brand] || []).find(i => i.name === name);
    if (!item) return bot.sendMessage(chatId, "Skonis nerastas");
    bot.sendMessage(chatId, `*${item.name}*\n${item.description}\n\nKaina: *5 €*`, { parse_mode: "Markdown" });
  }

  bot.answerCallbackQuery(q.id);
});

app.listen(PORT, () => {
  console.log(`Boto URL: ${URL}`);
  console.log(`Admin panelė: ${ADMIN_PANEL_URL}`);
  setupWebhook();
});
