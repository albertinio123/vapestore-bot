import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, "public")));

// === BOT TOKEN ===
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error(
    "FATAL: BOT_TOKEN nerastas! Eik į Vercel → Settings → Environment Variables"
  );
  process.exit(1);
}
console.log("BOT_TOKEN rastas:", TOKEN.substring(0, 10) + "...");

// PORT + PAGRINDINIS DOMENAS
const PORT = process.env.PORT || 3000;

// PRODUKCIJOJE VISADA NAUDOJAM PAGRINDINĮ DOMENĄ, NE SLUGĄ
const URL =
  process.env.NODE_ENV === "production"
    ? "https://vapestore-bot.vercel.app"
    : `http://localhost:${PORT}`;

const ADMIN_ID = 112336357;

// === EMOJI BRANDAMS ===
const BRAND_EMOJIS = {
  "Riot Squad": "💣",
  IVG: "⚡️",
  Hayati: "🔥",
  Elfbar: "🧃",
  "Lost Mary": "🌸",
  "SKE Crystal": "💎",
  Kingston: "👑",
  Fantasi: "✨",
  "Nasty Juice": "😈",
};

const carts = {};
let products = {};
const productsPath = join(__dirname, "products.json");

// === PRODUKTŲ ĮKĖLIMAS IŠ FAILO ===
function loadProducts() {
  try {
    const data = fs.readFileSync(productsPath, "utf8");
    products = JSON.parse(data);
    console.log("Produktai įkelti:", Object.keys(products).length, "brendai");
  } catch (err) {
    console.log("products.json nerastas – pradedam tuščiai");
    products = {};
  }
}
loadProducts();

// === TELEGRAM BOTAS (WEBHOOK REŽIMU) ===
const bot = new TelegramBot(TOKEN, { webHook: true });

// === WEBHOOK NUSTATYMAS TELEGRAM'E ===
async function setupWebhook() {
  const webhookUrl = `${URL}/api/bot`;
  try {
    await bot.setWebHook(webhookUrl);
    console.log("WEBHOOK NUSTATYTAS:", webhookUrl);
  } catch (err) {
    console.error("WEBHOOK KLAIDA: FATAL:", err.message);
  }
}

// === API MARŠRUTAI (VERCEL) ===

// Telegram webhook – POST iš Telegram
app.post("/api/bot", (req, res) => {
  try {
    console.log(
      "GAUTAS UPDATE IŠ TELEGRAM:",
      JSON.stringify(req.body).substring(0, 200)
    );
    bot.processUpdate(req.body);
    // Telegramui svarbu gauti 200 – negrąžinam jokių 401
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("KLAIDA APDOROJANT UPDATE:", err);
    // Net jei įvyko klaida, Telegram vis tiek grąžinam 200,
    // kad nevarytų "Wrong response 401"
    return res.status(200).json({ ok: true });
  }
});

// Sveikatos / testinis endpointas – kad GET /api/bot neduotų 401
app.get("/api/bot", (req, res) => {
  res.status(200).send("OK");
});

// Pagrindinis puslapis
app.get("/", (req, res) => {
  res.send(`VapeStore botas veikia! <a href="/admin">Admin</a>`);
});

// Admin panelė
app.get("/admin", (req, res) => {
  res.sendFile(join(__dirname, "public", "admin.html"));
});

// API – gauti produktus
app.get("/api/products", (req, res) => {
  res.json(products);
});

// API – pridėti produktą
app.post("/api/products", (req, res) => {
  const { brand, name, description, photo_url, price } = req.body;

  if (!brand || !name || !description) {
    return res.status(400).json({ error: "Trūksta duomenų" });
  }

  if (!products[brand]) products[brand] = [];
  products[brand].push({
    name,
    description,
    photo_url,
    price: price || 5,
  });

  try {
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
  } catch (err) {
    console.error("Nepavyko išsaugoti products.json:", err.message);
  }

  res.json({ success: true });
});

// === BENDRAS LOG'as VISOMS ŽINUTĖMS ===
bot.on("message", (msg) => {
  console.log("GAUTA ŽINUTĖ:", msg.text, "iš", msg.from.id);
});

// === /START – GRAŽUS PAGRINDINIS MENIU ===
bot.onText(/\/start/, (msg) => {
  console.log("/start iš", msg.from.id);

  const text = [
    "👋 Sveikas atvykęs į *VapeStore LT* 🛒",
    "",
    "Čia gali patogiai peržiūrėti populiariausius *vape e-skysčius*.",
    "",
    "Pasirink, nuo ko norėtum pradėti:",
  ].join("\n");

  bot
    .sendMessage(msg.chat.id, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🧃 E-skysčiai (brendai)", callback_data: "category_liquids" }],
          [{ text: "🛒 Mano krepšelis", callback_data: "open_cart" }],
        ],
      },
    })
    .catch((err) =>
      console.error("NEPAVYKO IŠSIŲSTI /start ŽINUTĖS:", err.message)
    );
});

// === /ADMIN – NUORODA Į ADMIN PANELĘ ===
bot.onText(/\/admin/, (msg) => {
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, "Drausta.");
  }
  bot.sendMessage(msg.chat.id, `Admin: ${URL}/admin`);
});

// === /CART – KREPŠELIS PER KOMANDĄ ===
bot.onText(/\/cart/, (msg) => {
  const userId = msg.from.id;
  const cart = carts[userId] || { products: [], total: 0 };

  if (cart.products.length === 0) {
    return bot.sendMessage(userId, "🛒 Tavo krepšelis šiuo metu tuščias.");
  }

  let text = `*Tavo krepšelis:*\n\n`;
  cart.products.forEach((p) => {
    text += `${p.name} – ${p.price} €\n`;
  });
  text += `\nIš viso: *${cart.total} €*`;

  bot.sendMessage(userId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Patvirtinti užsakymą", callback_data: `order_${cart.total}` }],
      ],
    },
  });
});

// === CALLBACK MYGTUKAI ===
bot.on("callback_query", async (q) => {
  console.log("CALLBACK:", q.data);
  const chatId = q.message.chat.id;
  const userId = q.from.id;
  const data = q.data;

  // 🛒 KREPŠELIS IŠ /START
  if (data === "open_cart") {
    const cart = carts[userId] || { products: [], total: 0 };

    if (cart.products.length === 0) {
      return bot.sendMessage(chatId, "🛒 Tavo krepšelis šiuo metu tuščias.");
    }

    let text = `*Tavo krepšelis:*\n\n`;
    cart.products.forEach((p) => {
      text += `${p.name} – ${p.price} €\n`;
    });
    text += `\nIš viso: *${cart.total} €*`;

    return bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Patvirtinti užsakymą", callback_data: `order_${cart.total}` }],
        ],
      },
    });
  }

  // 🧃 BRANDŲ SĄRAŠAS
  if (data === "category_liquids" || data === "list_brands") {
    const brands = Object.keys(products);
    if (brands.length === 0) {
      return bot.sendMessage(chatId, "Šiuo metu prekių nėra 😔");
    }

    const keyboard = brands.map((b) => {
      const emoji = BRAND_EMOJIS[b] || "🔹";
      return [
        {
          text: `${emoji} ${b}`,
          callback_data: `brand_${b}`,
        },
      ];
    });

    return bot.sendMessage(chatId, "🧃 Pasirink e-skysčių brendą:", {
      reply_markup: { inline_keyboard: keyboard },
    });
  }

  // SKONIŲ SĄRAŠAS PASIRINKUS BRENDĄ
  if (data.startsWith("brand_")) {
    const brand = data.slice(6);
    const items = products[brand] || [];

    if (items.length === 0) {
      return bot.sendMessage(
        chatId,
        `Šiuo metu iš *${brand}* skonių nėra.`,
        { parse_mode: "Markdown" }
      );
    }

    const keyboard = items.map((i) => [
      {
        text: `🔸 ${i.name}`,
        callback_data: `flavor_${brand}_${i.name}`,
      },
    ]);

    return bot.sendMessage(
      chatId,
      `*${brand}* skoniai:\n\nPasirink norimą skonį, kad pamatytum aprašymą ir kainą 👇`,
      {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard },
      }
    );
  }

  // VIENO SKONIO INFORMACIJA + FOTO
  if (data.startsWith("flavor_")) {
    const parts = data.split("_").slice(1);
    const brand = parts[0];
    const name = parts.slice(1).join(" ");

    const item = (products[brand] || []).find((i) => i.name === name);
    if (!item) return;

    await bot.sendPhoto(chatId, item.photo_url, {
      caption: `*${item.name}*\n\n${item.description}\n\nKaina: *${item.price} €*`,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "➕ Į krepšelį", callback_data: `add_${brand}_${name}` }],
        ],
      },
    });
  }

  // PRIDĖJIMAS Į KREPŠELĮ
  if (data.startsWith("add_")) {
    const parts = data.split("_").slice(1);
    const brand = parts[0];
    const name = parts.slice(1).join(" ");

    const item = (products[brand] || []).find((i) => i.name === name);
    if (!item) return;

    if (!carts[userId]) carts[userId] = { products: [], total: 0 };
    carts[userId].products.push(item);
    carts[userId].total += item.price;

    return bot.sendMessage(
      chatId,
      `Pridėta: *${item.name}* | Iš viso: ${carts[userId].total} €`,
      { parse_mode: "Markdown" }
    );
  }

  // UŽSAKYMO PATVIRTINIMAS
  if (data.startsWith("order_")) {
    const total = parseInt(data.split("_")[1], 10);
    const order = carts[userId]?.products || [];

    let text = `UŽSAKYMAS:\n\n`;
    order.forEach((p) => {
      text += `${p.name} – ${p.price} €\n`;
    });
    text += `\nIš viso: ${total} €\nVartotojas: ${userId}`;

    await bot.sendMessage(ADMIN_ID, text);
    await bot.sendMessage(
      chatId,
      "✅ Užsakymas išsiųstas! Su tavimi susisieksime artimiausiu metu."
    );

    delete carts[userId];
  }

  bot.answerCallbackQuery(q.id);
});

// === SERVERIO PALEIDIMAS ===
app.listen(PORT, async () => {
  console.log(`SERVERIS VEIKIA: ${URL}`);
  console.log(`ADMIN PANELĖ: ${URL}/admin`);
  await setupWebhook();
});
