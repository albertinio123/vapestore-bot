import express from "express";
import "dotenv/config";
import fs from "fs";

// Nuskaitome produktų duomenis iš JSON failo
const products = JSON.parse(fs.readFileSync("products.json", "utf-8"));

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

const app = express();
app.use(express.json());

// Pagrindinis meniu
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🍓 E-Liquids", callback_data: "E-Liquids / Skysčiai" }],
      [{ text: "📦 Pods", callback_data: "Pods / Pod Sistemos" }],
      [{ text: "⚙️ Mods", callback_data: "Mods / Modai" }],
      [{ text: "🔥 Coils", callback_data: "Coils / Kaitinimo Galvutės" }],
      [{ text: "🎒 Accessories", callback_data: "Accessories / Priedai" }]
    ]
  }
};

// Webhook maršrutas
app.post("/api/bot", async (req, res) => {
  const msg = req.body.message;
  const data = req.body.callback_query;

  // /start komanda
  if (msg?.text === "/start") {
    await sendMessage(
      msg.chat.id,
      "Sveiki! 👋\n\nPasirinkite prekių kategoriją:",
      mainMenu
    );
  }

  // Paspaudimai ant mygtukų
  if (data) {
    const chatId = data.message.chat.id;
    const category = data.data;

    const categoryData = products[category];
    if (!categoryData) {
      await sendMessage(chatId, "❌ Kategorija nerasta.");
      return res.sendStatus(200);
    }

    // Parodome pogrupius (pvz. Fruit / Menthol)
    const subcategories = Object.keys(categoryData);
    const buttons = subcategories.map(sub => [{ text: sub, callback_data: `${category}|${sub}` }]);

    await sendMessage(chatId, `📦 *${category}* kategorijos:`, {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: "Markdown"
    });
  }

  // Jei paspausta subkategorija
  if (data?.data?.includes("|")) {
    const [category, subcategory] = data.data.split("|");
    const chatId = data.message.chat.id;
    const items = products[category]?.[subcategory] || [];

    if (!items.length) {
      await sendMessage(chatId, "📭 Ši kategorija neturi prekių.");
      return res.sendStatus(200);
    }

    // Išsiunčiame kiekvieną produktą
    for (const item of items) {
      const caption = `*${item.title}*\n${item.description}\n\n💰 Kaina: ${item.price || "nenurodyta"}`;
      await sendPhoto(chatId, item.image, caption);
    }
  }

  res.sendStatus(200);
});

// Siunčia tekstinius pranešimus
async function sendMessage(chatId, text, extra = {}) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
  });
}

// Siunčia nuotraukas
async function sendPhoto(chatId, photo, caption = "") {
  await fetch(`${API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, photo, caption, parse_mode: "Markdown" })
  });
}

app.listen(3000, () => console.log("✅ Bot running on port 3000"));
