import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// Įkraunam produktus
const filePath = path.join(process.cwd(), "products.json");
let products = {};

try {
  const rawData = fs.readFileSync(filePath, "utf8");
  products = JSON.parse(rawData);
  console.log("✅ products.json sėkmingai įkrautas.");
} catch (error) {
  console.error("❌ Nepavyko įkrauti products.json:", error.message);
}

// --- Telegram funkcijos ---
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

async function sendPhoto(chatId, photoUrl, caption, options = {}) {
  try {
    await fetch(`${API}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: "Markdown",
        ...options,
      }),
    });
  } catch (err) {
    console.error("❌ Klaida siunčiant nuotrauką:", err.message);
  }
}

// --- Meniu ---
function getMainMenu() {
  const categories = Object.keys(products);
  const buttons = categories.map((cat) => [
    { text: `📦 ${cat}`, callback_data: `cat|${cat}` },
  ]);

  return { reply_markup: { inline_keyboard: buttons } };
}

function getSubMenu(categoryName) {
  const subcategories = Object.keys(products[categoryName] || {});
  const buttons = subcategories.map((sub) => [
    { text: `🛍️ ${sub}`, callback_data: `sub|${categoryName}|${sub}` },
  ]);
  buttons.push([{ text: "⬅️ Grįžti atgal", callback_data: "back_main" }]);
  return { reply_markup: { inline_keyboard: buttons } };
}

function getProductsMenu(category, subcategory) {
  const items = products[category]?.[subcategory] || [];
  const buttons = items.map((item, i) => [
    { text: `💨 ${item.title}`, callback_data: `prod|${category}|${subcategory}|${i}` },
  ]);
  buttons.push([{ text: "⬅️ Atgal", callback_data: `cat|${category}` }]);
  return { reply_markup: { inline_keyboard: buttons } };
}

async function showProduct(chatId, category, subcategory, index) {
  const product = products[category]?.[subcategory]?.[index];
  if (!product) return;

  const caption = `*${product.title}*\n\n${product.description}\n\n💰 *Kaina:* ${product.price} €\n📦 *Kiekis:* ${product.stock}`;

  await sendPhoto(chatId, product.image, caption, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "⬅️ Atgal", callback_data: `sub|${category}|${subcategory}` }],
      ],
    },
  });
}

// --- Handler ---
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("✅ Botas veikia");

  const body = req.body;

  try {
    if (body.message?.text === "/start") {
      const chatId = body.message.chat.id;
      await sendMessage(chatId, "👋 Sveiki atvykę į *VapeStore Bot!*\nPasirinkite kategoriją:", getMainMenu());
    }

    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      const data = body.callback_query.data.split("|");

      if (data[0] === "cat") {
        await sendMessage(chatId, `📦 *${data[1]}*`, getSubMenu(data[1]));
      } else if (data[0] === "sub") {
        await sendMessage(chatId, `🛍️ *${data[2]}* produktai:`, getProductsMenu(data[1], data[2]));
      } else if (data[0] === "prod") {
        await showProduct(chatId, data[1], data[2], data[3]);
      } else if (data[0] === "back_main") {
        await sendMessage(chatId, "🔙 Grįžote į pagrindinį meniu:", getMainMenu());
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Klaida:", err.message);
    res.status(500).send("Serverio klaida");
  }
}
