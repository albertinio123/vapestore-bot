import express from "express";
import "dotenv/config";

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

const app = express();
app.use(express.json());

// Main menu with inline buttons
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🍓 E-Liquids", callback_data: "eliquids" }],
      [{ text: "📦 Pods", callback_data: "pods" }],
      [{ text: "⚙️ Mods", callback_data: "mods" }],
      [{ text: "🔥 Coils", callback_data: "coils" }],
      [{ text: "🎒 Accessories", callback_data: "accessories" }]
    ]
  }
};

// Route for Telegram webhook
app.post("/api/bot", async (req, res) => {
  const msg = req.body.message;
  const data = req.body.callback_query;

  // Handle /start command
  if (msg?.text === "/start") {
    await sendMessage(
      msg.chat.id,
      "Sveiki! 👋\n\nPasirinkite prekių kategoriją:",
      mainMenu
    );
  }

  // Handle category button clicks
  if (data) {
    const chatId = data.message.chat.id;
    const texts = {
      eliquids: "📦 *E-Liquids katalogas*\n\nČia bus jūsų skonių kategorijos.",
      pods: "📦 *Pod sistemų katalogas*.",
      mods: "⚙️ *Modų katalogas*.",
      coils: "🔥 *Coil'ų katalogas*.",
      accessories: "🎒 *Priedų katalogas*."
    };
    await sendMessage(chatId, texts[data.data] || "❓ Nežinoma komanda");
  }

  res.sendStatus(200);
});

// Function to send messages via Telegram API
async function sendMessage(chatId, text, extra = {}) {
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
}

app.listen(3000, () => console.log("✅ Bot running"));
