export default async function handler(req, res) {
    const TOKEN = process.env.BOT_TOKEN;
    const API = `https://api.telegram.org/bot${TOKEN}`;

    if (req.method === "POST") {
        const msg = req.body.message;
        const query = req.body.callback_query;

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
        }

        return res.status(200).json({ ok: true });
    }

    return res.status(200).send("Bot is running.");
}
