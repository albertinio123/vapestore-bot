import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// --- Įkrauname produktus iš JSON failo ---
const filePath = path.join(process.cwd(), "products.json");
let products = {};

try {
  const rawData = fs.readFileSync(filePath, "utf8");
  products = JSON.parse(rawData);
  console.log("✅ products.json sėkmingai įkrautas.");
} catch (error) {
  console.error("❌ Nepavyko įkrauti products.json:", error.message);
}

// --- Telegram žinutės siuntimo funkcija ---
async function sendMessage(chatId, text, options = {}) {
  try {
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        ...options,
      }),
    });
  } catch (err) {
    console.error("❌ Klaida siunčiant žinutę:", err.message);
  }
}

// --- Pagrindinis meniu: kategorijos (LT + EN) ---
function getMainMenu() {
  const categories = Object.keys(products);
  const buttons = categories.map((cat) => [
    {
      text: cat, // jau yra EN/LT kartu, pvz. "E-Liquids / Skysčiai"
      callback_data: `cat_${cat}`,
    },
  ]);

  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// --- Subkategorijos (tik EN) ---
function getSubCategoriesMenu(categoryName) {
  const category = products[categoryName];
  if (!category) return null;

  const subcategories = Object.keys(category);
  const buttons = subcategories.map((sub) => [
    {
      text: sub, // tik EN pavadinimai
      callback_data: `sub_${categoryName}_${sub}`,
    },
  ]);

  buttons.push([{ text: "⬅️ Back", callback_data: "back_main" }]);

  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// --- Produktai konkrečioje subkategorijoje ---
function getProductsMenu(categoryName, subName) {
  const subcategory = products[categoryName]?.[subName];
  if (!subcategory) return null;

  const buttons = subcategory.map((item) => [
    {
      text: item.title || "Unnamed product",
      url: item.image, // galima pakeisti į produktų nuorodą jei turi
    },
  ]);

  buttons.push([
    { text: "⬅️ Back", callback_data: `cat_${categoryName}` },
  ]);

  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// --- Pagrindinis handleris (API endpoint) ---
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Botas veikia ✅");
  }

  const body = req.body;

  try {
    // --- Komanda /start ---
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text;

      if (text === "/start") {
        await sendMessage(
          chatId,
          "👋 Sveiki atvykę į VapeStore Bot!\nPasirinkite prekių kategoriją:",
          getMainMenu()
        );
      }
    }

    // --- Callback'ai (mygtukai) ---
    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      const data = body.callback_query.data;

      if (data.startsWith("cat_")) {
        const cat = data.replace("cat_", "");
        const menu = getSubCategoriesMenu(cat);
        if (menu) {
          await sendMessage(chatId, `📦 ${cat} kategorija:`, menu);
        } else {
          await sendMessage(chatId, "⚠️ Tuščia kategorija.", getMainMenu());
        }
      } else if (data.startsWith("sub_")) {
        const [, cat, sub] = data.split("_");
        const menu = getProductsMenu(cat, sub);
        if (menu) {
          await sendMessage(chatId, `🛒 ${sub} produktai:`, menu);
        } else {
          await sendMessage(chatId, "⚠️ Šioje subkategorijoje nėra produktų.", getMainMenu());
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
