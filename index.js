import TelegramBot from "node-telegram-bot-api";
import fs from "fs";

// 🧩 Bot token iš aplinkos kintamojo (Vercel → Settings → Environment Variables)
const token = process.env.BOT_TOKEN;

// ⚙️ Admin ID (įrašyk savo Telegram ID)
const ADMIN_ID = 123456789; // <- pakeisk į savo ID

// 🚀 Paleidžiam bota
const bot = new TelegramBot(token, { polling: true });

// 📦 Užkraunam produktus
let products = JSON.parse(fs.readFileSync("./products.json", "utf8"));

// 🔹 /start komanda
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Sveikas atvykęs į 💨 *VAPE STORE!*", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "💨 Skysčiai", callback_data: "skysciai" }]],
    },
  });
});

// 🔹 /help komanda
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "📘 *Pagalba:*\n\n" +
      "💨 /start – pradinis meniu\n" +
      "ℹ️ /help – šis pagalbos pranešimas\n" +
      "🔧 /admin – valdymas (tik administratoriui)",
    { parse_mode: "Markdown" }
  );
});

// 🔹 /admin komanda – leidžia pridėti naują produktą
bot.onText(/\/admin/, (msg) => {
  const chatId = msg.chat.id;
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(chatId, "❌ Neturi prieigos prie administratoriaus funkcijų.");
  }

  bot.sendMessage(
    chatId,
    "🛠 *Admin meniu:*\nĮvesk naują produktą tokiu formatu:\n\n" +
      "`Brendas | Skonis | Aprašymas`",
    { parse_mode: "Markdown" }
  );

  bot.once("message", (msg) => {
    if (!msg.text.includes("|")) return;
    const [brand, name, description] = msg.text.split("|").map((x) => x.trim());

    if (!products[brand]) products[brand] = [];
    products[brand].push({ name, description });

    fs.writeFileSync("./products.json", JSON.stringify(products, null, 2));
    bot.sendMessage(chatId, `✅ Produktas "${name}" pridėtas prie ${brand}`);
  });
});

// 🔹 Callback'ai
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === "skysciai") {
    const brands = Object.keys(products);
    const keyboard = brands.map((brand) => [{ text: brand, callback_data: `brand_${brand}` }]);
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
    const flavorName = parts.slice(2).join("_");
    const flavor = products[brand].find((f) => f.name === flavorName);

    bot.sendMessage(
      chatId,
      `🥤 *${flavor.name}*\n\n${flavor.description}\n\n💸 Kaina: *5 €*`,
      { parse_mode: "Markdown" }
    );
  }

  bot.answerCallbackQuery(query.id);
});
