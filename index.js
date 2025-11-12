import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// --- Skaityti produktus iš JSON failo ---
const productsPath = path.resolve("products.json");
let products = [];
try {
  const data = fs.readFileSync(productsPath, "utf8");
  products = JSON.parse(data);
} catch (err) {
  console.error("❌ Nepavyko įkelti products.json:", err.message);
}

// --- Funkcija siųsti žinutę ---
async function sendMessage(chatId, text, extra = {}) {
  try {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown"
    };

    if (extra.reply_markup) {
      payload.reply_markup = extra.reply_markup;
    }

    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.error("❌ Nepavyko išsiųsti žinutės:", err.message);
  }
}

// --- Funkcija rodyti pagrindinį meniu ---
function getMainMenu() {
  const buttons = products.map((cat) => [
    { text: `${cat.name.en} / ${cat.name.lt}`, callback_data: `cat_${cat.id}` }
  ]);

  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

// --- Funkcija rodyti subkategorijas ---
function getSubCategoriesMenu(catId) {
  const category = products.find((c) => c.id === catId);
  if (!category || !category.subcategories) return null;

  const buttons = category.subcategories.map((sub) => [
    { text: sub.name, callback_data: `sub_${catId}_${sub.id}` }
  ]);

  buttons.push([{ text: "⬅️ Back", callback_data: "back_main" }]);

  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

// --- Funkcija rodyti produktus ---
function getProductsMenu(catId, subId) {
  const category = products.find((c) => c.id === catId);
  if (!category) return null;
  const sub = category.subcategories.find((s) => s.id === subId);
  if (!sub) return null;

  const buttons = sub.items.map((item) => [
    { text: `${item.name} - ${item.price}`, url: item.link }
  ]);

  buttons.push([{ text: "⬅️ Back", callback_data: `cat_${catId}` }]);

  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

// --- Pagrindinis API handler ---
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is running");
  }

  const body = req.body;

  try {
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text;

      if (text === "/start") {
        await sendMessage(chatId, "👋 Sveiki! Pasirinkite prekių kategoriją:", getMainMenu());
      }
    }

    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      const data = body.callback_query.data;

      if (data.startsWith("cat_")) {
        const catId = data.replace("cat_", "");
        const menu = getSubCategoriesMenu(catId);
        if (menu) {
          await sendMessage(chatId, "📦 Choose a subcategory:", menu);
        } else {
          await sendMessage(chatId, "⚠️ Ši kategorija tuščia.", getMainMenu());
        }
      } else if (data.startsWith("sub_")) {
        const [, catId, subId] = data.split("_");
        const menu = getProductsMenu(catId, subId);
        if (menu) {
          await sendMessage(chatId, "🛒 Available products:", menu);
        } else {
          await sendMessage(chatId, "⚠️ Ši subkategorija neturi prekių.", getMainMenu());
        }
      } else if (data === "back_main") {
        await sendMessage(chatId, "🔙 Grįžote į pagrindinį meniu:", getMainMenu());
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Klaida:", err.message);
    res.status(500).send("Internal Server Error");
  }
}
