import express from "express";
import "dotenv/config";
import fs from "fs";

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

// Nuskaitom produktus
let products = {};
try {
  products = JSON.parse(fs.readFileSync("products.json", "utf-8"));
  console.log("✅ products.json nuskaitytas sėkmingai");
} catch (err) {
  console.error("❌ Klaida skaitant products.json:", err.message);
}

// Pagrindinis meniu
const mainMenu = {
  reply_markup: {
    inline_keyboard: Object.keys(products).map((category) => [
      { text: category, callback_data: category }
    ])
  }
};

// Webhook endpoint
app.post("/api/bot", async (req, res) => {
  try {
    const message = req.body.message;
    const callback = req.body.callback_query;

    // --- Start komanda ---
    if (message?.text === "/start") {
      await sendMessage(
        message.chat.id,
        "👋 Sveiki! Pasirinkite prekių kategoriją:",
        mainMenu
      );
      return res.sendStatus(200);
    }

    // --- Kategorijos pasirinkimas ---
    if (callback && !callback.data.includes("|")) {
      const chatId = callback.message.chat.id;
      const category = callback.data;
      const categoryData = products[category];

      if (!categoryData) {
        await sendMessage(chatId, "❌ Kategorija nerasta.");
        return res.sendStatus(200);
      }

      const subcategories = Object.keys(categoryData);
      const buttons = subcategories.map((sub) => [
        { text: sub, callback_data: `${category}|${sub}` }
      ]);

      await sendMessage(chatId, `📦 *${category}* kategorijos:`, {
        reply_markup: { inline_keyboard: buttons },
        parse_mode: "Markdown"
      });
      return res.sendStatus(200);
    }

    // --- Subkategorijos pasirinkimas ---
    if (callback?.data?.includes("|")) {
      const [category, subcategory] = callback.data.split("|");
      const chatId = callback.message.chat.id;
      const items = products[category]?.[subcategory] || [];

      if (items.length === 0) {
        await sendMessage(chatId, "📭 Šioje subkategorijoje prekių nėra.");
        return res.sendStatus(200);
      }

      for (const item of items) {
        const caption = `*${item.title}*\n${item.description}\n\n💰 Kaina: ${
          item.price || "nenurodyta"
        }`;
        await sendPhoto(chatId, item.image, caption);
      }
      return res.sendStatus(200);
    }

    // Jei ne /start ir ne callback
    return res.sendStatus(200);
  } catch (err) {
    console.error("❌ Klaida apdorojant užklausą:", err.message);
    res.sendStatus(500);
  }
});

// Siunčia tekstinę žinutę
async function sendMessage(chatId, text, extra = {}) {
  try {
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        ...extra
      })
    });
  } catch (err) {
    console.error("❌ Nepavyko išsiųsti žinutės:", err.message);
  }
}

// Siunčia nuotrauką
async function sendPhoto(chatId, photo, caption = "") {
  try {
    await fetch(`${API}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo,
        caption,
        parse_mode: "Markdown"
      })
    });
  } catch (err) {
    console.error("❌ Nepavyko išsiųsti nuotraukos:", err.message);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Botas paleistas ant ${PORT} porto`));

export default app;
