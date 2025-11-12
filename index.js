import express from "express";
import "dotenv/config";
import fs from "fs";
import path from "path";

// Jei fetch nėra (kai kurios Node versijos), pridedam node-fetch
if (typeof fetch === "undefined") {
  global.fetch = (await import("node-fetch")).default;
}

// ✅ Nuskaitom produktų JSON saugiai su absoliučiu keliu
let products = {};
try {
  const filePath = path.join(process.cwd(), "products.json");
  const jsonData = fs.readFileSync(filePath, "utf-8");
  products = JSON.parse(jsonData);
  console.log("✅ products.json sėkmingai nuskaitytas");
} catch (err) {
  console.error("❌ Nepavyko nuskaityti products.json:", err.message);
}

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

// Webhook endpoint
app.post("/api/bot", async (req, res) => {
  try {
    const msg = req.body.message;
    const data = req.body.callback_query;

    // Start komanda
    if (msg?.text === "/start") {
      await sendMessage(
        msg.chat.id,
        "Sveiki! 👋\n\nPasirinkite prekių kategoriją:",
        mainMenu
      );
    }

    // Kategorijos pasirinkimas
    if (data && !data.data.includes("|")) {
      const chatId = data.message.chat.id;
      const category = data.data;
      const categoryData = products[category];

      if (!categoryData) {
        console.warn(`⚠️ Kategorija nerasta: ${category}`);
        await sendMessage(chatId, "❌ Kategorija nerasta.");
        return res.sendStatus(200);
      }

      const subcategories = Object.keys(categoryData);
      const buttons = subcategories.map((s) => [
        { text: s, callback_data: `${category}|${s}` }
      ]);

      await sendMessage(chatId, `📦 *${category}* kategorijos:`, {
        reply_markup: { inline_keyboard: buttons },
        parse_mode: "Markdown"
      });
    }

    // Subkategorijos pasirinkimas
    if (data?.data?.includes("|")) {
      const [category, subcategory] = data.data.split("|");
      const chatId = data.message.chat.id;
      const items = products[category]?.[subcategory] || [];

      if (!items.length) {
        await sendMessage(chatId, "📭 Ši kategorija neturi prekių.");
        return res.sendStatus(200);
      }

      for (const item of items) {
        const caption = `*${item.title}*\n${item.description}\n\n💰 Kaina: ${
          item.price || "nenurodyta"
        }`;
        await sendPhoto(chatId, item.image, caption);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Klaida apdorojant užklausą:", err.message);
    res.sendStatus(500);
  }
});

// Siunčia tekstą
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

// Siunčia nuotraukas
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
app.listen(PORT, () => console.log(`✅ Botas veikia ant ${PORT} porto`));

// Reikalinga Vercel
export default app;
