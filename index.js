import express from "express";
import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const URL = process.env.VERCEL_URL || "https://vapestore-bot.vercel.app";
const ADMIN_ID = 123456789; // ← Pakeisk į savo Telegram ID

// Inicializuojam botą (be polling, tik webhook)
const bot = new TelegramBot(TOKEN);

// Nustatom webhook (tik jei dar nėra)
async function setWebhook() {
  const webhookUrl = `${URL}/webhook/${TOKEN}`;
  try {
    const current = await bot.getWebHookInfo();
    if (current.url !== webhookUrl) {
      await bot.setWebHook(webhookUrl);
      console.log("Webhook nustatytas:", webhookUrl);
    } else {
      console.log("Webhook jau nustatytas:", webhookUrl);
    }
  } catch (err) {
    console.error("Klaida nustatant webhook:", err.message);
  }
}

// Produktai
let products = {};
const productsPath = path.join(process.cwd(), "products.json");

try {
  const data = fs.readFileSync(productsPath, "utf8");
  products = JSON.parse(data);
  console.log("Produktai įkelti iš products.json");
} catch (err) {
  console.log("⚠️ products.json nerastas – sukuriamas tuščias.");
  products = {};
}

// Webhook maršrutas
app.post(`/webhook/${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Testinis maršrutas
app.get("/", (_, res) => {
  res.send("✅ VapeStore bot is running!");
});

// Komandos
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "💨 Sveikas atvykęs į *VapeStore*!", {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "Skysčiai", callback_data: "list_brands" }]],
    },
  });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Komandos:\n/start – pradėti\n/help – pagalba\n/admin – valdymas (tik adminui)",
    { parse_mode: "Markdown" }
  );
});

bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "❌ Prieiga uždrausta.");
  }

  bot.sendMessage(msg.chat.id, "Įrašyk: `Brendas | Skonis | Aprašymas`", {
    parse_mode: "Markdown",
  });

  bot.once("message", (m) => {
    if (m.chat.id !== msg.chat.id || !m.text || !m.text.includes("|")) {
      return bot.sendMessage(msg.chat.id, "❌ Blogas formatas. Naudok: `Brendas | Skonis | Aprašymas`");
    }

    const [brand, name, desc] = m.text.split("|").map((x) => x.trim());
    if (!brand || !name || !desc) {
      return bot.sendMessage(msg.chat.id, "❌ Trūksta duomenų.");
    }

    if (!products[brand]) products[brand] = [];
    products[brand].push({ name, description: desc });

    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
    bot.sendMessage(msg.chat.id, `✅ Pridėta prie *${brand}*: **${name}**`, { parse_mode: "Markdown" });
  });
});

// Callback query
bot.on("callback_query", (q) => {
  const chatId = q.message.chat.id;
  const data = q.data;

  if (data === "list_brands") {
    const brands = Object.keys(products);
    if (brands.length === 0) {
      return bot.sendMessage(chatId, "Nėra produktų duomenų ❌");
    }

    const keyboard = brands.map((b) => [{ text: b, callback_data: `brand_${b}` }]);
    bot.sendMessage(chatId, "Pasirinkite brendą:", {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  if (data.startsWith("brand_")) {
    const brand = data.replace("brand_", "");
    const flavors = products[brand] || [];

    if (flavors.length === 0) {
      return bot.sendMessage(chatId, `Nėra skonių iš *${brand}*`, { parse_mode: "Markdown" });
    }

    const keyboard = flavors.map((f) => [
      { text: f.name, callback_data: `flavor_${brand}_${f.name}` },
    ]);

    bot.sendMessage(chatId, `Pasirinkite skonį iš *${brand}*:`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  if (data.startsWith("flavor_")) {
    const parts = data.split("_").slice(1); // pašalinam "flavor"
    const brand = parts[0];
    const name = parts.slice(1).join("_");
    const flavor = (products[brand] || []).find((f) => f.name === name);

    if (!flavor) {
      return bot.sendMessage(chatId, "Skonis nerastas ❌");
    }

    bot.sendMessage(
      chatId,
      `🥤 *${flavor.name}*\n${flavor.description}\n\n💸 Kaina: *5 €*`,
      { parse_mode: "Markdown" }
    );
  }

  bot.answerCallbackQuery(q.id);
});

// Paleidžiam serverį ir webhook
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Serveris veikia ant porto ${PORT}`);
  await setWebhook();
});
