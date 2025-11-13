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

// === KONFIGAS ===
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error(
    "FATAL: BOT_TOKEN nerastas! Eik į Vercel → Settings → Environment Variables"
  );
}
console.log("BOT_TOKEN:", TOKEN ? TOKEN.substring(0, 10) + "..." : "NĖRA!");

const ADMIN_ID = 112336357;

// Domenas (jei kada keisi domeną, pakeisi čia vieną eilutę)
const BASE_URL = "https://vapestore-bot.vercel.app";

// Placeholder paveiksliukas, jei produktas neturi savo photo_url
const DEFAULT_PHOTO_URL =
  "https://via.placeholder.com/600x600.png?text=Vape+Product";

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

// Skonių kategorijų žodžiai (ieškoma pavadinime + aprašyme, lower-case)
const FLAVOR_CATEGORIES = {
  fruits: {
    title: "🍓 Vaisiai & uogos",
    keywords: [
      "strawberry",
      "brašk",
      "berry",
      "uog",
      "mango",
      "apple",
      "apelsin",
      "orange",
      "pear",
      "kriauš",
      "kiwi",
      "grape",
      "vynuog",
      "fruit",
      "melons",
      "arbūz",
      "watermelon",
      "pineapple",
      "ananas",
      "peach",
      "persik",
    ],
  },
  drinks: {
    title: "🥤 Gėrimai / limonadai / cola",
    keywords: [
      "cola",
      "coca",
      "lemonade",
      "limonad",
      "soda",
      "fanta",
      "sprite",
      "energy",
      "energetin",
      "juice",
      "sult",
    ],
  },
  desserts: {
    title: "🍰 Desertai & saldumynai",
    keywords: [
      "dessert",
      "desert",
      "cake",
      "tort",
      "donut",
      "sprinkle",
      "cookie",
      "sausain",
      "pudding",
      "cream",
      "vanilla",
      "karamel",
      "caramel",
      "custard",
      "sweet",
      "sald",
    ],
  },
  tobacco: {
    title: "🌿 Tabakas / tabakas + vanilė",
    keywords: ["tobacco", "tabak", "cigar", "virginia", "classic"],
  },
  ice: {
    title: "❄️ Šaltukas / mentolis / ice",
    keywords: ["ice", "cool", "menthol", "mint", "icy", "šalt", "mėta"],
  },
  bar: {
    title: "🧪 Bar stiliaus miksai",
    keywords: ["bar", "bar juice", "disposable", "5000", "bar style"],
  },
};

const carts = {}; // userId -> { items: [{brand,name,price,qty}], total }
const ordersByUser = {}; // userId -> [ {items,total,createdAt} ]
const favoritesByUser = {}; // userId -> [{brand,name}]
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

// === TELEGRAM BOTAS (webhook režimu) ===
const bot = TOKEN ? new TelegramBot(TOKEN, { webHook: true }) : null;

// ==========================================================
//  API MARŠRUTAI (VERCEL)
// ==========================================================

// Telegram webhook – POST iš Telegram
app.post("/api/bot", (req, res) => {
  try {
    console.log(
      "GAUTAS UPDATE IŠ TELEGRAM:",
      JSON.stringify(req.body).substring(0, 200)
    );
    if (bot) {
      bot.processUpdate(req.body);
    } else {
      console.error("BOT_TOKEN nerastas – negaliu apdoroti update");
    }
  } catch (err) {
    console.error("KLAIDA APDOROJANT UPDATE:", err);
  }

  // Visada 200, kad Telegram nematytų 401
  return res.status(200).json({ ok: true });
});

// Testinis endpointas – kad GET /api/bot neduotų 401
app.get("/api/bot", (req, res) => {
  res.status(200).send("OK");
});

// Pagrindinis puslapis
app.get("/", (req, res) => {
  res
    .status(200)
    .send(
      `VapeStore botas veikia! <a href="/admin">Admin</a> | <a href="/api/bot">/api/bot</a>`
    );
});

// Admin panelė
app.get("/admin", (req, res) => {
  res.sendFile(join(__dirname, "public", "admin.html"));
});

// API – gauti produktus
app.get("/api/products", (req, res) => {
  res.json(products);
});

// API – pridėti produktą (admin forma)
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

// ==========================================================
//  PAGALBINĖS FUNKCIJOS
// ==========================================================

function getOrCreateCart(userId) {
  if (!carts[userId]) {
    carts[userId] = { items: [], total: 0 };
  }
  return carts[userId];
}

function recalcTotal(cart) {
  cart.total = cart.items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

function addToCart(cart, brand, name, price) {
  const existing = cart.items.find(
    (it) => it.brand === brand && it.name === name
  );
  if (existing) {
    existing.qty += 1;
  } else {
    cart.items.push({ brand, name, price, qty: 1 });
  }
  recalcTotal(cart);
}

function changeQty(cart, brand, name, delta) {
  const item = cart.items.find((it) => it.brand === brand && it.name === name);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart.items = cart.items.filter(
      (it) => !(it.brand === brand && it.name === name)
    );
  }
  recalcTotal(cart);
}

function deleteFromCart(cart, brand, name) {
  cart.items = cart.items.filter(
    (it) => !(it.brand === brand && it.name === name)
  );
  recalcTotal(cart);
}

// Top 10 (paima iki 10 pirmų produktų)
function getTop10Products() {
  const list = [];
  for (const [brand, items] of Object.entries(products)) {
    for (const item of items) {
      list.push({ brand, ...item });
    }
  }
  return list.slice(0, 10);
}

// Užsakymų įrašymas
function saveOrder(userId, cart) {
  if (!ordersByUser[userId]) ordersByUser[userId] = [];
  ordersByUser[userId].push({
    items: cart.items.map((it) => ({ ...it })),
    total: cart.total,
    createdAt: new Date().toISOString(),
  });
}

// Užsakymų sąrašas
function formatOrdersList(userId) {
  const list = ordersByUser[userId] || [];
  if (list.length === 0) {
    return "📦 Šiuo metu neturi išsaugotų užsakymų šio boto sesijoje.";
  }

  let out = "*Tavo užsakymai:*\n\n";
  list.forEach((o, idx) => {
    const date = new Date(o.createdAt).toLocaleString("lt-LT");
    out += `#${idx + 1} – ${date} – ${o.total} €\n`;
  });
  out += "\nDetalios info – ateityje galėsim rodyti atskirai.";
  return out;
}

// Produktų paieška pagal skonio kategoriją
function getProductsByFlavorCategory(key) {
  const cat = FLAVOR_CATEGORIES[key];
  if (!cat) return [];
  const keywords = cat.keywords;
  const result = [];

  for (const [brand, items] of Object.entries(products)) {
    for (const item of items) {
      const text = `${item.name} ${item.description}`.toLowerCase();
      if (keywords.some((kw) => text.includes(kw))) {
        result.push({ brand, item });
      }
    }
  }

  return result;
}

// Krepšelio atvaizdavimas
async function sendCartMessage(chatId, userId) {
  const cart = getOrCreateCart(userId);

  if (cart.items.length === 0) {
    await bot.sendMessage(chatId, "🛒 Tavo krepšelis šiuo metu tuščias.");
    return;
  }

  let text = "*Tavo krepšelis:*\n\n";
  cart.items.forEach((it, idx) => {
    text += `${idx + 1}. ${it.name} (${it.brand}) – ${it.qty} vnt. x ${
      it.price
    } € = ${it.price * it.qty} €\n`;
  });
  text += `\nIš viso: *${cart.total} €*`;

  const keyboard = [];

  cart.items.forEach((it) => {
    keyboard.push([
      {
        text: `➖`,
        callback_data: `cart_dec_${it.brand}_${it.name}`,
      },
      {
        text: `${it.name} (${it.qty} vnt.)`,
        callback_data: "noop",
      },
      {
        text: `➕`,
        callback_data: `cart_inc_${it.brand}_${it.name}`,
      },
    ]);
    keyboard.push([
      {
        text: "🗑 Pašalinti",
        callback_data: `cart_del_${it.brand}_${it.name}`,
      },
    ]);
  });

  keyboard.push([
    {
      text: "✅ Patvirtinti užsakymą",
      callback_data: `order_${cart.total}`,
    },
  ]);
  keyboard.push([
    { text: "⬅️ Į pagrindinį meniu", callback_data: "go_home" },
  ]);

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

// ==========================================================
//  TELEGRAM LOGIKA
// ==========================================================

// Pagrindinis meniu kaip funkcija
function sendMainMenu(chatId) {
  const text = [
    "👋 Sveiki atvykę į *VapeStore LT* nic salt e-shopą Telegram!",
    "",
    "Prekiaujame tik nic salt e-skysčiais. Tik 18+ vartotojams.",
    "",
    "Meniu:",
  ].join("\n");

  return bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🛒 Nic salt skysčiai (20 mg, 10 ml)",
            callback_data: "nic_salts",
          },
        ],
        [{ text: "⭐ Top 10 skonių", callback_data: "top10" }],
        [{ text: "🔥 Akcijos ir rinkiniai", callback_data: "promos" }],
        [{ text: "📦 Mano užsakymai", callback_data: "my_orders" }],
        [{ text: "💬 Pagalba", callback_data: "help" }],
        [{ text: "ℹ️ Apie mus", callback_data: "about" }],
        [
          {
            text: "💨 Vape įrenginiai (netrukus)",
            callback_data: "devices_soon",
          },
        ],
      ],
    },
  });
}

if (bot) {
  // Bendras log'as
  bot.on("message", (msg) => {
    console.log("GAUTA ŽINUTĖ:", msg.text, "iš", msg.from.id);
  });

  // /start – pagrindinis meniu
  bot.onText(/\/start/, (msg) => {
    sendMainMenu(msg.chat.id).catch((err) =>
      console.error("NEPAVYKO IŠSIŲSTI /start ŽINUTĖS:", err.message)
    );
  });

  // /menu – tas pats, kas /start
  bot.onText(/\/menu/, (msg) => {
    sendMainMenu(msg.chat.id).catch((err) =>
      console.error("NEPAVYKO IŠSIŲSTI /menu ŽINUTĖS:", err.message)
    );
  });

  // /admin – nuoroda į admin panelę
  bot.onText(/\/admin/, (msg) => {
    if (msg.from.id !== ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, "Drausta.");
    }
    bot.sendMessage(msg.chat.id, `Admin: ${BASE_URL}/admin`);
  });

  // /cart – krepšelis per komandą
  bot.onText(/\/cart/, (msg) => {
    const userId = msg.from.id;
    sendCartMessage(msg.chat.id, userId).catch((err) =>
      console.error("KLAIDA SIUNČIANT KREPŠELĮ:", err.message)
    );
  });

  // /orders – užsakymų istorija
  bot.onText(/\/orders/, (msg) => {
    const userId = msg.from.id;
    const text = formatOrdersList(userId);
    bot.sendMessage(userId, text, { parse_mode: "Markdown" });
  });

  // /help – pagalba
  bot.onText(/\/help/, (msg) => {
    const text = [
      "💬 *Pagalba*",
      "",
      "Klausimai dėl užsakymų, asortimento ar pristatymo:",
      "- Rašyk čia į chatą;",
      "- arba susisiek su adminu: @TavoKontaktas (pakeisi į savo).",
    ].join("\n");
    bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
  });

  // === CALLBACK MYGTUKAI ===
  bot.on("callback_query", async (q) => {
    console.log("CALLBACK:", q.data);
    const chatId = q.message.chat.id;
    const userId = q.from.id;
    const data = q.data;

    try {
      // specialus "nieko nedaryk"
      if (data === "noop") {
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // 🏠 Grįžti į pagrindinį meniu
      if (data === "go_home") {
        await sendMainMenu(chatId);
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Nic salt skysčiai – pagrindinis pasirinkimas
      if (data === "nic_salts") {
        await bot.sendMessage(
          chatId,
          "🛒 Nic salt skysčiai\n\nRinkis, kaip tau patogiau:",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🍓 Pagal skonį",
                    callback_data: "nic_by_flavor",
                  },
                ],
                [
                  {
                    text: "🧪 Pagal brandą",
                    callback_data: "nic_by_brand",
                  },
                ],
                [{ text: "⬅️ Į pagrindinį", callback_data: "go_home" }],
              ],
            },
          }
        );
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Nic salt – pagal skonį (kategorijų pasirinkimas)
      if (data === "nic_by_flavor") {
        await bot.sendMessage(
          chatId,
          "🍓 Rinkis skonio kategoriją:",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🍓 Vaisiai & uogos",
                    callback_data: "flavorcat_fruits",
                  },
                ],
                [
                  {
                    text: "🥤 Gėrimai / limonadai / cola",
                    callback_data: "flavorcat_drinks",
                  },
                ],
                [
                  {
                    text: "🍰 Desertai & saldumynai",
                    callback_data: "flavorcat_desserts",
                  },
                ],
                [
                  {
                    text: "🌿 Tabakas / tabakas + vanilė",
                    callback_data: "flavorcat_tobacco",
                  },
                ],
                [
                  {
                    text: "❄️ Šaltukas / mentolis / ice",
                    callback_data: "flavorcat_ice",
                  },
                ],
                [
                  {
                    text: "🧪 Bar stiliaus miksai",
                    callback_data: "flavorcat_bar",
                  },
                ],
                [
                  {
                    text: "⬅️ Atgal",
                    callback_data: "nic_salts",
                  },
                ],
              ],
            },
          }
        );
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Skonio kategorijos – rodom produktų sąrašą
      if (data.startsWith("flavorcat_")) {
        const key = data.split("_")[1];
        const cat = FLAVOR_CATEGORIES[key];
        const list = getProductsByFlavorCategory(key);

        if (!cat) {
          await bot.sendMessage(
            chatId,
            "Šiai skonių kategorijai filtravimas dar neparuoštas."
          );
          await bot.answerCallbackQuery(q.id);
          return;
        }

        if (list.length === 0) {
          await bot.sendMessage(
            chatId,
            `${cat.title}\n\nŠiai kategorijai dar nepriskirta skonių. Bandyk rinktis *pagal brandą*.`,
            { parse_mode: "Markdown" }
          );
        } else {
          const keyboard = list.map(({ brand, item }) => [
            {
              text: `${item.name} (${brand})`,
              callback_data: `flavor_${brand}_${item.name}`,
            },
          ]);

          keyboard.push([
            {
              text: "⬅️ Atgal į skonių kategorijas",
              callback_data: "nic_by_flavor",
            },
          ]);
          keyboard.push([
            { text: "🛒 Mano krepšelis", callback_data: "open_cart" },
          ]);

          await bot.sendMessage(
            chatId,
            `${cat.title}\n\nPasirink skonį:`,
            { reply_markup: { inline_keyboard: keyboard } }
          );
        }

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Nic salt – pagal brandą
      if (data === "nic_by_brand" || data === "category_liquids") {
        const brands = Object.keys(products);
        if (brands.length === 0) {
          await bot.sendMessage(chatId, "Šiuo metu prekių nėra 😔");
        } else {
          const keyboard = brands.map((b) => {
            const emoji = BRAND_EMOJIS[b] || "🔹";
            return [
              {
                text: `${emoji} ${b}`,
                callback_data: `brand_${b}`,
              },
            ];
          });

          keyboard.push([
            { text: "⬅️ Į pagrindinį", callback_data: "go_home" },
            { text: "🛒 Mano krepšelis", callback_data: "open_cart" },
          ]);

          await bot.sendMessage(chatId, "🧪 Pasirink e-skysčių brendą:", {
            reply_markup: { inline_keyboard: keyboard },
          });
        }

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // 🛒 Krepšelis
      if (data === "open_cart") {
        await sendCartMessage(chatId, userId);
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Skonių sąrašas pasirinkus brendą
      if (data.startsWith("brand_")) {
        const brand = data.slice(6);
        const items = products[brand] || [];

        if (items.length === 0) {
          await bot.sendMessage(
            chatId,
            `Šiuo metu iš *${brand}* skonių nėra.`,
            { parse_mode: "Markdown" }
          );
        } else {
          const keyboard = items.map((i) => [
            {
              text: `🔹 ${i.name}`,
              callback_data: `flavor_${brand}_${i.name}`,
            },
          ]);

          keyboard.push([
            {
              text: "⬅️ Atgal į brendus",
              callback_data: "nic_by_brand",
            },
            { text: "🛒 Mano krepšelis", callback_data: "open_cart" },
          ]);

          await bot.sendMessage(
            chatId,
            `${brand} skoniai:\n\nPasirink norimą skonį, kad pamatytum aprašymą ir kainą 👇`,
            {
              reply_markup: { inline_keyboard: keyboard },
            }
          );
        }

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Vieno skonio info + nuotrauka
      if (data.startsWith("flavor_")) {
        const parts = data.split("_").slice(1);
        const brand = parts[0];
        const name = parts.slice(1).join(" ");

        const item = (products[brand] || []).find((i) => i.name === name);
        if (!item) {
          await bot.answerCallbackQuery(q.id);
          return;
        }

        const inline_keyboard = [
          [
            {
              text: "➕ Į krepšelį",
              callback_data: `add_${brand}_${name}`,
            },
            {
              text: "❤️ Į mėgstamiausius",
              callback_data: `fav_${brand}_${name}`,
            },
          ],
          [
            {
              text: "⬅️ Atgal į skonius",
              callback_data: `brand_${brand}`,
            },
            { text: "🛒 Mano krepšelis", callback_data: "open_cart" },
          ],
        ];

        let photoUrl = item.photo_url || DEFAULT_PHOTO_URL;
        if (!photoUrl.startsWith("http")) {
          photoUrl = `${BASE_URL}/${photoUrl.replace(/^\/+/, "")}`;
        }

        console.log("SIUNČIAM FOTO URL:", photoUrl);

        try {
          await bot.sendPhoto(chatId, photoUrl, {
            caption: `${item.name}\n\n${item.description}\n\nTalpa: 10 ml\nNikotinas: 20 mg nic salt (2%)\nRekomenduojama: pod / MTL\nKaina: ${item.price} €`,
            reply_markup: { inline_keyboard },
          });
        } catch (err) {
          console.error("SENDPHOTO KLAIDA:", err.message);

          await bot.sendMessage(
            chatId,
            `*${item.name}*\n\n${item.description}\n\nTalpa: 10 ml\nNikotinas: 20 mg nic salt (2%)\nRekomenduojama: pod / MTL\nKaina: *${item.price} €*`,
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard },
            }
          );
        }

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Pridėjimas į krepšelį
      if (data.startsWith("add_")) {
        const parts = data.split("_").slice(1);
        const brand = parts[0];
        const name = parts.slice(1).join(" ");

        const item = (products[brand] || []).find((i) => i.name === name);
        if (!item) {
          await bot.answerCallbackQuery(q.id);
          return;
        }

        const cart = getOrCreateCart(userId);
        addToCart(cart, brand, name, item.price);

        await bot.sendMessage(
          chatId,
          `Pridėta: *${item.name}* | Iš viso: ${cart.total} €`,
          { parse_mode: "Markdown" }
        );

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Mėgstamiausi
      if (data.startsWith("fav_")) {
        const parts = data.split("_").slice(1);
        const brand = parts[0];
        const name = parts.slice(1).join(" ");

        if (!favoritesByUser[userId]) favoritesByUser[userId] = [];
        const exists = favoritesByUser[userId].some(
          (f) => f.brand === brand && f.name === name
        );
        if (!exists) {
          favoritesByUser[userId].push({ brand, name });
        }

        await bot.answerCallbackQuery(q.id, {
          text: "Pridėta į mėgstamiausius ❤️",
          show_alert: false,
        });
        return;
      }

      // Krepšelio +/− ir trynimas
      if (
        data.startsWith("cart_inc_") ||
        data.startsWith("cart_dec_") ||
        data.startsWith("cart_del_")
      ) {
        const [action, brand, ...nameParts] = data.split("_").slice(1);
        const name = nameParts.join(" ");
        const cart = getOrCreateCart(userId);

        if (action === "inc") {
          changeQty(cart, brand, name, 1);
        } else if (action === "dec") {
          changeQty(cart, brand, name, -1);
        } else if (action === "del") {
          deleteFromCart(cart, brand, name);
        }

        await sendCartMessage(chatId, userId);
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Užsakymo patvirtinimas
      if (data.startsWith("order_")) {
        const cart = getOrCreateCart(userId);

        if (cart.items.length === 0) {
          await bot.sendMessage(chatId, "Krepšelis tuščias.");
          await bot.answerCallbackQuery(q.id);
          return;
        }

        const total = cart.total;

        let text = `UŽSAKYMAS:\n\n`;
        cart.items.forEach((p) => {
          text += `${p.name} (${p.brand}) – ${p.qty} vnt. x ${p.price} € = ${
            p.price * p.qty
          } €\n`;
        });
        text += `\nIš viso: ${total} €\nVartotojas: ${userId}`;

        await bot.sendMessage(ADMIN_ID, text);
        await bot.sendMessage(
          chatId,
          [
            "✅ Užsakymas išsiųstas!",
            "",
            "✉️ Parašyk čia savo *vardą, pavardę, pristatymo miestą ir paštomatą*.",
            "💳 Apmokėjimo info (bankas / Revolut) bus atsiųsta asmeniškai.",
          ].join("\n"),
          { parse_mode: "Markdown" }
        );

        saveOrder(userId, cart);
        carts[userId] = { items: [], total: 0 };

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // ⭐ TOP 10
      if (data === "top10") {
        const list = getTop10Products();
        if (list.length === 0) {
          await bot.sendMessage(chatId, "Šiuo metu produktų dar nėra.");
        } else {
          let text = "*TOP 10 skonių (pagal e-shopą):*\n\n";
          list.forEach((p, idx) => {
            text += `${idx + 1}. ${p.brand} – ${p.name} (${p.price} €)\n`;
          });
          text +=
            "\nPasirink norimą brendą per „Nic salt skysčiai → pagal brandą“, kad peržiūrėtum konkrečius skonius.";
          await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
        }

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // 🔥 Akcijos ir rinkiniai
      if (data === "promos") {
        await bot.sendMessage(
          chatId,
          "🔥 Akcijos ir rinkiniai netrukus atsiras čia.\n\nKol kas gali rinktis skysčius per „Nic salt skysčiai“ meniu."
        );
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // 📦 Mano užsakymai
      if (data === "my_orders") {
        const text = formatOrdersList(userId);
        await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // 💬 Pagalba
      if (data === "help") {
        const text = [
          "💬 *Pagalba*",
          "",
          "Klausimai dėl užsakymo, pristatymo ar asortimento?",
          "",
          "- Parašyk žinutę čia į chatą;",
          "- arba susisiek su adminu: @TavoKontaktas (įrašysi savo).",
        ].join("\n");
        await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // ℹ️ Apie mus
      if (data === "about") {
        const text = [
          "ℹ️ *Apie VapeStore LT*",
          "",
          "Telegram nic salt e-shopas, orientuotas į kokybiškus 20 mg, 10 ml skysčius.",
          "Asortimentas: populiariausi UK ir EU brendai.",
          "",
          "Daugiau informacijos ir bendradarbiavimo pasiūlymai – rašyk adminui.",
        ].join("\n");
        await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // 💨 Vape įrenginiai (netrukus)
      if (data === "devices_soon") {
        await bot.sendMessage(
          chatId,
          "💨 Vape įrenginių kategorija bus pridėta vėliau.\n\nKol kas fokusuojamės į nic salt skysčius."
        );
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // jei neatpažintas callback
      await bot.answerCallbackQuery(q.id);
    } catch (err) {
      console.error("CALLBACK KLAIDA:", err);
      try {
        await bot.answerCallbackQuery(q.id);
      } catch (e) {}
    }
  });
}

// Vercel pasiima Express app
export default app;
