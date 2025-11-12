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

// --- Emoji kategorijoms ---
const categoryIcons = {
  "E-Liquids / Skysčiai": "💧",
  "Pods / Pod sistemos": "🔋",
  "Mods / Modai": "⚙️",
  "Coils / Kaitinimo galvutės": "🔩",
  "Accessories / Priedai": "🎒"
};

// --- Emoji subkategorijoms ---
const subIcons = {
  Fruit: "🍓",
  Menthol: "❄️",
  Closed: "🔒",
  Open: "🔓",
  Box: "📦",
  Mechanical: "⚡",
  Mesh: "🧵",
  Chargers: "🔌",
  Tanks: "🫙"
};

// --- Siunčia paprastą žinutę ---
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

// --- Siunčia produkto nuotrauką ---
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

// --- Pagrindinis meniu: kategorijos (LT + EN + emoji) ---
function getMainMenu() {
  const categories = Object.keys(products);
  const buttons = categories.map((cat) => [
    {
      text: `${categoryIcons[cat] || "📁"} ${cat}`,
      callback_data: `cat_${cat}`,
    },
  ]);

  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// --- Subkategorijos (tik EN + emoji) ---
function getSubCategoriesMenu(categoryName) {
  const category = products[categoryName];
  if (!category) return null;

  const subcategories = Object.keys(category);
  const buttons = subcategories.map((sub) => [
    {
      text: `${subIcons[sub] || "📦"} ${sub}`,
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

  const buttons = subcategory.map((item, index) => [
    {
      text: `${item.title || "Unnamed"}`,
      callback_data: `prod_${categoryName}_${subName}_${index}`,
    },
  ]);

  buttons.push([{ text: "⬅️ Back", callback_data: `cat_${categoryName}` }]);

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
    // --- /start komanda ---
    if (body.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text;

      if (text === "/start") {
        await sendMessage(
          chatId,
          "👋 Sveiki atvykę į *VapeStore Bot!*\nPasirinkite prekių kategoriją:",
          getMainMenu()
        );
      }
    }

    // --- Callback'ai (mygtukai) ---
    if (body.callback_query) {
      const chatId = body.callback_query.message.chat.id;
      const data = body.callback_query.data;

      // --- Kategorija ---
      if (data.startsWith("cat_")) {
        const cat = data.replace("cat_", "");
        const menu = getSubCategoriesMenu(cat);
        if (menu) {
          await sendMessage(chatId, `📦 *${cat}*`, menu);
        } else {
          await sendMessage(chatId, "⚠️ Tuščia kategorija.", getMainMenu());
        }
      }

      // --- Subkategorija ---
      else if (data.startsWith("sub_")) {
        const [, cat, sub] = data.split("_");
        const menu = getProductsMenu(cat, sub);
        if (menu) {
          await sendMessage(chatId, `🛒 *${sub}* produktai:`, menu);
        } else {
          await sendMessage(chatId, "⚠️ Šioje subkategorijoje nėra produktų.", getMainMenu());
        }
      }

      // --- Produktas ---
      else if (data.startsWith("prod_")) {
        const [, cat, sub, index] = data.split("_");
        const product = products[cat]?.[sub]?.[index];
        if (product) {
          const caption = `*${product.title}*\n\n${product.description}\n\n💰 Kaina: ${product.price || "nenurodyta"}`;
          await sendPhoto(chatId, product.image, caption, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🛒 Pirkti dabar", url: "https://tavo-svetaine.lt" }
                ],
                [{ text: "⬅️ Grįžti", callback_data: `sub_${cat}_${sub}` }]
              ],
            },
          });
        }
      }

      // --- Grįžimas į pagrindinį meniu ---
      else if (data === "back_main") {
        await sendMessage(chatId, "🔙 Grįžote į pagrindinį meniu:", getMainMenu());
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Klaida:", err.message);
    res.status(500).send("Internal Server Error");
  }
}
