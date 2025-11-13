import express from "express";
import TelegramBot from "node-telegram-bot-api";

const app = express();
app.use(express.json());

const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) {
  console.error("BOT_TOKEN nerastas!");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN);

app.post("/api/bot", (req,
