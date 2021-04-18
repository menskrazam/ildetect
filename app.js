require('dotenv').config();
const express = require('express');
const { Telegraf } = require('telegraf');
const { v4: uuidv4 } = require('uuid');

const urlValidate = require('./tasks');

// Init app
if (!process.env.TOKEN) {
  throw new Error('TOKEN must be provided!');
}

if (!process.env.PORT) {
  throw new Error('PORT must be provided!');
}

if (!process.env.SERVER_URL) {
  throw new Error('SERVER_URL must be provided!');
}

// Set up settings
const token = process.env.TOKEN;
const port = process.env.PORT;
const serverUrl = process.env.SERVER_URL ? process.env.SERVER_URL.replace(/\/$/, '') : '';
const endpoint = uuidv4();
const webHookUrl = `${serverUrl}/${endpoint}`;

// Create bot
const bot = new Telegraf(token);

// Set telegram webhook
bot.telegram.setWebhook(webHookUrl);

// Start command
bot.command('start', (ctx) => {
  return ctx.reply('Привет! Последнее время наши косорылые губошлепики используют сервис iplogger.org для выяснения ваших IP адресов. Они просто закидываю ссылку как будто это короткая ссылка и при переходе по ней палят ваш IP. Этот бот позволяет проверить ссылку и убедится, сделана она с помощью iplogger.org или нет. Конечно, существуют и другие способы запалить и проверка не гарантирует что в ссылке нет каких либо еще гадостей. Поэтому лучше ВСЕ пускать через ВПН, а из "рабочей" телеги не открывать ссылки вообще. А мы, как время будет, еще допишем проверок и на другие случаи жизни. Короче ближе к делу. Вводите адреса на проверку. Одно сообщение - один адрес.');
});

// Check link
bot.on('text', async (ctx, next) => urlValidate(ctx, next));

// Create express server
const app = express();

// Set the bot API endpoint
app.use(bot.webhookCallback(`/${endpoint}`));

// Start server
app.listen(port, () => {
  console.log(`Bot app listening on port ${port}! Endpoint registered on ${webHookUrl}`);
});
