import TelegramBot from "node-telegram-bot-api";
import fs from "fs";

// tavo Telegram botos token
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// užkraunam produktus
const products = JSON.parse(fs.readFileSync("./products.json", "utf8"));

// paleidimo žinutė
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "Sveikas atvykęs į VAPE STORE 💨\nPasirinkite kategoriją:", {
    reply_markup: {
      inline_keyboard: [[{ text: "💨 Skysčiai", callback_data: "skysciai" }]],
    },
  });
});

// kai spaudžiam „Skysčiai“
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

  // pasirenkamas brendas
  if (data.startsWith("brand_")) {
    const brand = data.replace("brand_", "");
    const flavors = products[brand];

    const keyboard = flavors.map((flavor) => [
      { text: flavor.name, callback_data: `flavor_${brand}_${flavor.name}` },
    ]);

    bot.sendMessage(chatId, `Pasirinkite skonį iš ${brand}:`, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  // pasirenkamas skonis
  if (data.startsWith("flavor_")) {
    const [_, brand, flavorName] = data.split("_");
    const flavor = products[brand].find((f) => f.name === flavorName);

    bot.sendMessage(
      chatId,
      `🥤 *${flavor.name}*\n\n${flavor.description}\n\n💸 Kaina: *5 €*`,
      { parse_mode: "Markdown" }
    );
  }

  bot.answerCallbackQuery(query.id);
});
