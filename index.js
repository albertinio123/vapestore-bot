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
}

console.log("BOT_TOKEN rastas:", TOKEN ? TOKEN.substring(0, 10) + "..." : "NĖRA!");

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

// ==========================================================
//  TELEGRAM LOGIKA
// ==========================================================

// Pagrindinis meniu kaip funkcija
function sendMainMenu(chatId) {
  const text = [
    "👋 Sveikas atvykęs į *VapeStore LT* 🛒",
    "",
    "Čia gali patogiai peržiūrėti populiariausius *vape e-skysčius*.",
    "",
    "Pasirink, nuo ko norėtum pradėti:",
  ].join("\n");

  return bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "🧃 E-skysčiai (brendai)",
            callback_data: "category_liquids",
          },
        ],
        [{ text: "🛒 Mano krepšelis", callback_data: "open_cart" }],
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
    console.log("/start iš", msg.from.id);
    sendMainMenu(msg.chat.id).catch((err) =>
      console.error("NEPAVYKO IŠSIŲSTI /start ŽINUTĖS:", err.message)
    );
  });

  // /admin – nuoroda į admin panelę
  bot.onText(/\/admin/, (msg) => {
    if (msg.from.id !== ADMIN_ID) {
      return bot.sendMessage(msg.chat.id, "Drausta.");
    }
    bot.sendMessage(msg.chat.id, `Admin: https://vapestore-bot.vercel.app/admin`);
  });

  // /cart – krepšelis per komandą
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
          [
            {
              text: "✅ Patvirtinti užsakymą",
              callback_data: `order_${cart.total}`,
            },
          ],
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

    try {
      // 🏠 Grįžti į pagrindinį meniu
      if (data === "go_home") {
        await sendMainMenu(chatId);
        await bot.answerCallbackQuery(q.id);
        return;
      }

      // 🛒 Krepšelis
      if (data === "open_cart") {
        const cart = carts[userId] || { products: [], total: 0 };

        if (cart.products.length === 0) {
          await bot.sendMessage(chatId, "🛒 Tavo krepšelis šiuo metu tuščias.");
        } else {
          let text = `*Tavo krepšelis:*\n\n`;
          cart.products.forEach((p) => {
            text += `${p.name} – ${p.price} €\n`;
          });
          text += `\nIš viso: *${cart.total} €*`;

          await bot.sendMessage(chatId, text, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✅ Patvirtinti užsakymą",
                    callback_data: `order_${cart.total}`,
                  },
                ],
                [
                  {
                    text: "⬅️ Atgal į e-skysčius",
                    callback_data: "category_liquids",
                  },
                ],
              ],
            },
          });
        }

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // 🧃 Brandų sąrašas
      if (data === "category_liquids" || data === "list_brands") {
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

          await bot.sendMessage(chatId, "🧃 Pasirink e-skysčių brendą:", {
            reply_markup: { inline_keyboard: keyboard },
          });
        }

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
              text: `🔸 ${i.name}`,
              callback_data: `flavor_${brand}_${i.name}`,
            },
          ]);

          keyboard.push([
            {
              text: "⬅️ Atgal į brendus",
              callback_data: "category_liquids",
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

        // Bendras inline keyboard šitam langui
        const inline_keyboard = [
          [
            {
              text: "➕ Į krepšelį",
              callback_data: `add_${brand}_${name}`,
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

        // jei nėra nuotraukos – tik tekstas
        if (!item.photo_url) {
          await bot.sendMessage(
            chatId,
            `*${item.name}*\n\n${item.description}\n\nKaina: *${item.price} €*`,
            {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard },
            }
          );
        } else {
          // paruošiam pilną URL:
          // - jei prasideda "http", paliekam kaip yra
          // - jei tik failo pavadinimas, pridedam domeną
          let photoUrl = item.photo_url;
          if (!photoUrl.startsWith("http")) {
            photoUrl = `https://vapestore-bot.vercel.app/${photoUrl.replace(
              /^\/+/,
              ""
            )}`;
          }

          console.log("SIUNČIAM FOTO URL:", photoUrl);

          try {
            await bot.sendPhoto(chatId, photoUrl, {
              caption: `${item.name}\n\n${item.description}\n\nKaina: ${item.price} €`,
              reply_markup: { inline_keyboard },
            });
          } catch (err) {
            console.error("SENDPHOTO KLAIDA:", err.message);

            // jei foto nesigavo – fallback į tekstą
            await bot.sendMessage(
              chatId,
              `*${item.name}*\n\n${item.description}\n\nKaina: *${item.price} €*`,
              {
                parse_mode: "Markdown",
                reply_markup: { inline_keyboard },
              }
            );
          }
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

        if (!carts[userId]) carts[userId] = { products: [], total: 0 };
        carts[userId].products.push(item);
        carts[userId].total += item.price;

        await bot.sendMessage(
          chatId,
          `Pridėta: *${item.name}* | Iš viso: ${carts[userId].total} €`,
          { parse_mode: "Markdown" }
        );

        await bot.answerCallbackQuery(q.id);
        return;
      }

      // Užsakymo patvirtinimas
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
