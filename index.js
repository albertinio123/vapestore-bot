import express from "express";
import "dotenv/config";
import fs from "fs";

// ---- Duomenys ----
const products = JSON.parse(fs.readFileSync("products.json", "utf-8"));

// Stabilūs ID -> katalogo rakto žemėlapis (turi sutapti su products.json viršaus raktais)
const CATEGORY_MAP = {
  eliquids: "E-Liquids / Skysčiai",
  pods: "Pods / Pod Sistemos",
  mods: "Mods / Modai",
  coils: "Coils / Kaitinimo Galvutės",
  accessories: "Accessories / Priedai",
};

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

const app = express();
app.use(express.json());

// ---- UI: pagrindinis meniu su STABILIAIS ID ----
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🍓 E-Liquids / Skysčiai", callback_data: "cat:eliquids" }],
      [{ text: "📦 Pods / Pod sistemos", callback_data: "cat:pods" }],
      [{ text: "⚙️ Mods / Modai", callback_data: "cat:mods" }],
      [{ text: "🔥 Coils / Kaitinimo galvutės", callback_data: "cat:coils" }],
      [{ text: "🎒 Accessories / Priedai", callback_data: "cat:accessories" }],
    ],
  },
};

// ---- Webhook endpoint ----
app.post("/api/bot", async (req, res) => {
  const msg = req.body.message;
  const cb = req.body.callback_query;

  // /start
  if (msg?.text === "/start") {
    await sendMessage(
      msg.chat.id,
      "Sveiki! 👋\n\nPasirinkite prekių kategoriją / Choose a product category:",
      mainMenu
    );
    return res.sendStatus(200);
  }

  // ----- Callback mygtukai -----
  if (cb?.data?.startsWith("cat:")) {
    const chatId = cb.message.chat.id;
    const catId = cb.data.split(":")[1]; // pvz. "eliquids"
    const catKey = CATEGORY_MAP[catId];  // pvz. "E-Liquids / Skysčiai"
    const categoryData = products[catKey];

    if (!categoryData) {
      await sendMessage(chatId, "❌ Kategorija nerasta.");
      return res.sendStatus(200);
    }

    const subcats = Object.keys(categoryData);
    const buttons = subcats.map((s) => [
      { text: s, callback_data: `sub:${catId}:${encodeURIComponent(s)}` },
    ]);

    buttons.push([{ text: "🏠 Main Menu", callback_data: "home" }]);

    await sendMessage(chatId, `📦 *${catKey}*`, {
      reply_markup: { inline_keyboard: buttons },
      parse_mode: "Markdown",
    });
    return res.sendStatus(200);
  }

  if (cb?.data?.startsWith("sub:")) {
    const chatId = cb.message.chat.id;
    const [, catId, encSub] = cb.data.split(":");
    const catKey = CATEGORY_MAP[catId];
    const subKey = decodeURIComponent(encSub);

    const items = products[catKey]?.[subKey] || [];
    if (!items.length) {
      await sendMessage(chatId, "📭 Ši subkategorija dar tuščia.");
      await sendMessage(chatId, "Pasirinkite kitą:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: `↩️ ${catKey}`, callback_data: `cat:${catId}` }],
            [{ text: "🏠 Main Menu", callback_data: "home" }],
          ],
        },
      });
      return res.sendStatus(200);
    }

    for (const item of items) {
      const caption = `*${item.title}*\n${item.description}${
        item.price ? `\n\n💰 ${item.price}` : ""
      }`;
      await sendPhoto(chatId, item.image, caption);
    }

    await sendMessage(chatId, "⬅️ Navigacija", {
      reply_markup: {
        inline_keyboard: [
          [{ text: `↩️ ${catKey}`, callback_data: `cat:${catId}` }],
          [{ text: "🏠 Main Menu", callback_data: "home" }],
        ],
      },
    });
    return res.sendStatus(200);
  }

  if (cb?.data === "home") {
    await sendMessage(cb.message.chat.id, "🏠 Pagrindinis meniu:", mainMenu);
    return res.sendStatus(200);
  }

  res.sendStatus(200);
});

// ---- Telegram helpers ----
async function sendMessage(chatId, text, extra = {}) {
  await fetch(`${API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      ...extra,
    }),
  });
}

async function sendPhoto(chatId, photo, caption = "") {
  await fetch(`${API}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo,
      caption,
      parse_mode: "Markdown",
    }),
  });
}

// ---- Svarbiausia vieta! ----
export default app;
