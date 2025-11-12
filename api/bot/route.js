export async function POST(req) {
  const TOKEN = process.env.BOT_TOKEN;
  const API = `https://api.telegram.org/bot${TOKEN}`;
  const body = await req.json();

  const msg = body.message;
  const query = body.callback_query;

  // START komanda
  if (msg?.text === "/start") {
    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: msg.chat.id,
        text: "Sveiki! 👋\n\nPasirinkite prekių kategoriją:",
        reply_markup: {
          inline_keyboard: [
            [{ text: "E-Liquid", callback_data: "eliquids" }],
            [{ text: "Pods", callback_data: "pods" }],
            [{ text: "Mods", callback_data: "mods" }],
            [{ text: "Coils", callback_data: "coils" }],
            [{ text: "Accessories", callback_data: "accessories" }]
          ]
        }
      })
    });

    return new Response("OK", { status: 200 });
  }

  // Mygtukų paspaudimai
  if (query) {
    const chatId = query.message.chat.id;

    await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Pasirinkta kategorija: ${query.data}`
      })
    });

    return new Response("OK", { status: 200 });
  }

  return new Response("Bot is running.", { status: 200 });
}
