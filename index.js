import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import express from "express";

const app = express();
app.use(express.json());

const token = process.env.BOT_TOKEN;
const domain = process.env.VERCEL_URL; // pvz.: "https://vapestore-bot.vercel.app"
const ADMIN_ID = 123456789; // tavo telegram ID

if (!token || !domain) throw new Error("❌ BOT_TOKEN arba VERCEL_URL nėra nustatyti!");

const bot = new TelegramBot(token);
bot.setWebHook(`${domain}/webhook/${token}`);

let products = JSON.parse(fs.readFileSync("./products.json", "utf8"));

// Webhook handler — Telegram kviečia šį URL
app.post(`/webhook/${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// 🔹 Start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Sveikas atvykęs į 💨 *VapeStore*!", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "💨 Skysčiai", callback_data: "skysciai" }]],
    },
  });
});

// 🔹 Help
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "📘 Pagalba:\n/start – pradėti\n/help – pagalba\n/admin – valdymas (tik adminui)",
    { parse_mode: "Markdown" }
  );
});

// 🔹 Admin
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID)
    return bot.sendMessage(msg.chat.id, "❌ Neturi prieigos prie administratoriaus meniu.");
  bot.sendMessage(msg.chat.id, "Įvesk: `Brendas | Skonis | Aprašymas`", { parse_mode: "Markdown" });

  bot.once("message", (m) => {
    if (!m.text.includes("|")) return;
    const [brand, name, description] = m.text.split("|").map((x) => x.trim());
    if (!products[brand]) products[brand] = [];
    products[brand].push({ name, description });
    fs.writeFileSync("./products.json", JSON.stringify(products, null, 2));
    bot.sendMessage(msg.chat.id, `✅ Pridėta prie ${brand}: ${name}`);
  });
});

// 🔹 Callback'ai
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "skysciai") {
    const brands = Object.keys(products);
    const keyboard = brands.map((b) => [{ text: b, callback_data: `brand_${b}` }]);
    bot.sendMessage(chatId, "Pasirinkite brendą:", {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  if (data.startsWith("brand_")) {
    const brand = data.replace("brand_", "");
    const flavors = products[brand];
    const keyboard = flavors.map((f) => [
      { text: f.name, callback_data: `flavor_${brand}_${f.name}` },
    ]);
    bot.sendMessage(chatId, `Pasirinkite skonį iš ${brand}:`, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  if (data.startsWith("flavor_")) {
    const [_, brand, ...flavorArr] = data.split("_");
    const flavorName = flavorArr.join("_");
    const flavor = products[brand].find((f) => f.name === flavorName);
    bot.sendMessage(
      chatId,
      `🥤 *${flavor.name}*\n\n${flavor.description}\n\n💸 Kaina: *5 €*`,
      { parse_mode: "Markdown" }
    );
  }

  bot.answerCallbackQuery(query.id);
});

// ✅ Paleidimo serveris
app.get("/", (req, res) => {
  res.send("Bot is running ✅");
});

app.listen(3000, () => console.log("Server started"));
