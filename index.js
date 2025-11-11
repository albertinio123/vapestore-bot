import express from "express";
import fetch from "node-fetch";

const TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

const app = express();
app.use(express.json());

// ✅ MAIN MENU (inline buttons)
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

// ✅ ROUTE FOR TELEGRAM WEBHOOK
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

  // Handle CATEGORY CLICK
  if (data) {
    const chatId = data.message.chat.id;

    if (data.data === "eliquids") {
      await sendMessage(
        chatId,
        "📦 *E-Liquids katalogas*\n\nČia bus jūsų skonių kategorijos.",
        {}
      );
    }
    if (data.data === "pods") {
      await sendMessage(chatId, "📦 *Pod sistemų katalogas*.", {});
    }
    if (data.data === "mods") {
      await sendMessage(chatId, "⚙️ *Modų katalogas*.", {});
    }
    if (data.data === "coils") {
      await sendMessage(chatId, "🔥 *Coil'ų katalogas*.", {});
    }
    if (data.data === "accessories") {
      await sendMessage(chatId, "🎒 *Priedų katalogas*.", {});
    }
  }

  res.sendStatus(200);
});

// ✅ SEND MESSAGE FUNCTION
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

app.listen(3000, () => console.log("Bot running"));
