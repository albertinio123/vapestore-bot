import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const URL = process.env.VERCEL_URL || "https://vapestore-bot.vercel.app";
const ADMIN_ID = 123456789; // <- įrašyk savo Telegram ID

// Sukuriam botą be polling, tik webhook
const bot = new TelegramBot(TOKEN);
bot.setWebHook(`${URL}/webhook/${TOKEN}`);

let products = {};
try {
  products = JSON.parse(fs.readFileSync("./products.json", "utf8"));
} catch {
  console.log("⚠️ products.json nerastas, sukuriamas tuščias objektas.");
  products = {};
}

// Telegram kvietimai ateina į šį kelią
app.post(`/webhook/${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Test route
app.get("/", (_, res) => {
  res.send("✅ VapeStore bot is running");
});

// Commandai
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "💨 Sveikas atvykęs į *VapeStore*!", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "🧃 Skysčiai", callback_data: "list_brands" }]],
    },
  });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🧩 Komandos:\n/start – pradėti\n/help – pagalba\n/admin – valdymas (tik adminui)",
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID)
    return bot.sendMessage(msg.chat.id, "❌ Prieiga uždrausta.");
  bot.sendMessage(msg.chat.id, "Įrašyk: `Brendas | Skonis | Aprašymas`", {
    parse_mode: "Markdown",
  });

  bot.once("message", (m) => {
    if (!m.text.includes("|")) return;
    const [brand, name, desc] = m.text.split("|").map((x) => x.trim());
    if (!products[brand]) products[brand] = [];
    products[brand].push({ name, description: desc });
    fs.writeFileSync("./products.json", JSON.stringify(products, null, 2));
    bot.sendMessage(msg.chat.id, `✅ Pridėta prie ${brand}: ${name}`);
  });
});

bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;

  if (data === "list_brands") {
    const brands = Object.keys(products);
    if (brands.length === 0)
      return bot.sendMessage(chatId, "Nėra produktų duomenų ❌");
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
    const parts = data.split("_");
    const brand = parts[1];
    const name = parts.slice(2).join("_");
    const flavor = products[brand].find((f) => f.name === name);
    bot.sendMessage(
      chatId,
      `🥤 *${flavor.name}*\n${flavor.description}\n\n💸 Kaina: *5 €*`,
      { parse_mode: "Markdown" }
    );
  }

  bot.answerCallbackQuery(q.id);
});

// Start server
app.listen(3000, () => console.log("🚀 Serveris startavo"));
