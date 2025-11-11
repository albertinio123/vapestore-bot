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
                text: "Sveiki! Ką norėsite pasirinkti prekių kategoriją?",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "E-Liquid", callback_data: "eleliquids" }],
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
        await fetch(`${API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: query.message.chat.id,
                text: `Pasirinkta kategorija: ${query.data}`
            })
        });

        return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
}

export function GET() {
    return new Response("Bot is running.", { status: 200 });
}
