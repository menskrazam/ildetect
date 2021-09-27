require('dotenv').config();
const got = require('got');
const lookup = require('safe-browse-url-lookup');

const eggs = require('./resources/easterEggsDomains.json');
const iploggerServers = require('./resources/iploggerDomains.json');
const userAgents = require('./resources/userAgents.json');
const domainWhitelist = require("./resources/whitelistedDomains.json");

const MSG_IPLOGGER_DETECTED = "‼️По ссылке обнаружен IPLogger. Ни в коем случае не открывайте её, это деанонимизирует вас!";
const MSG_404 = "❗️Невозможно найти страницу по ссылке. Проверка не выполнена.";
const MSG_500 = "❗️Страница по ссылке возвращает ошибку. Проверка не выполнена."
const MSG_LGTM = "✅ IPLogger не обнаружен, но это не является гарантией вашей безопасности. Открывайте на свой страх и риск.";
const MSG_NOT_AN_URL = "ℹ️ Это не ссылка.";

const MSG_GOOGLE_SBC_FAIL = "‼️Google Safe Browsing сообщает, что данная страница небезопасна для посещения. Ни в коем случае " +
  "не открывайте её, это может деанонимизировать вас или заразить ваше устройство вирусом!";

const URL_EXTRACT_REGEX = /(https?:\/\/[^\s]+)/g;

// Init google safe browser
const googleLookup = lookup({ apiKey: process.env.GOOGLE_API_KEY });

// Generate pattern string for iplogger domains validation
const iploggerServersPattern = `(${iploggerServers.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;

let logger;

const init = (log) => {
  logger = log;
}

const parseUrlFromText = (text) => {
  const normalizedText = !text ? '' : text.trim();
  if (!text) {
    return false;
  }
  let q = false;
  try {
    q = new URL(normalizedText);
  } catch (e) {}
  return q;
}

const isWhitelistedDomain = (url) => {
  return (domainWhitelist.filter((domain) => url.hostname.endsWith(domain)).length > 0);
}

// Easter effs validator
const easterEggsValidate = async (ctx, url, next) => {
  if (eggs.filter((domain) => url.hostname.endsWith(domain)).length > 0) {
    if (!isFromChat(ctx)) {
      await ctx.reply('А вот грязь в меня попрошу не кидать! Я к этим доменам не прикоснусь!');
      return;
    }
  }

  return iploggerValidate(ctx, next, url);
}

// Google Safe Browsing APIs (v4) validator
const googleSafeBrowsingValidate = async (ctx, next, url) => {
  const replyOps = { reply_to_message_id: ctx.message.message_id };

  let checkOnGoogle = false;

  logger.debug(`googleSafeBrowsingValidate check on ${url}`);

  try {
    checkOnGoogle = await googleLookup.checkSingle(url.toString());
  } catch (e) {
    logger.error(`googleSafeBrowsingValidate error on ${url}`, e);
    return next();
  }

  if (checkOnGoogle) {
    return ctx.reply(MSG_GOOGLE_SBC_FAIL, replyOps);
  }

  return next();
}

// IPLogger validator
const iploggerValidate = async (ctx, next, url) => {
  logger.debug(`IPLogger surface check on ${url}`);

  const replyOps = { reply_to_message_id: ctx.message.message_id };

  if (isIpLoggerUrl(url)) {
    return ctx.reply(MSG_IPLOGGER_DETECTED, replyOps);
  }

  let hasILLinks = false;
  let hasIlRedirect = false;
  let hasError = false;
  let hasErrorCode = false;
  let response = false;

  try {
    response = await checkIPLoggerRedirect(url.toString());
  } catch (error) {
    hasError = true;
    hasErrorCode = error.response && error.response.statusCode ? error.response.statusCode : false;
    hasIlRedirect = error.message === 'ipLoggerRedirect';
  }

  if (hasIlRedirect) {
    return ctx.reply(MSG_IPLOGGER_DETECTED, replyOps);
  }

  if (hasError && hasErrorCode && hasErrorCode === 404) {
    return ctx.reply(MSG_404, replyOps);
  }

  if (hasError && hasErrorCode) {
    return ctx.reply(MSG_500, replyOps);
  }

  if (hasError) {
    return ctx.reply(MSG_500, replyOps);
  }

  try {
    hasILLinks = new RegExp(iploggerServersPattern, 'i').test(response.body);
  } catch (error) {}

  if (hasILLinks) {
    return ctx.reply(MSG_IPLOGGER_DETECTED, replyOps);
  }

  // If all ok
  if (!isFromChat(ctx)) {
    await ctx.reply(MSG_LGTM, replyOps);
  }

  return googleSafeBrowsingValidate(ctx, next, url);
}

const isIpLoggerUrl = (url) => {
  if (!url) return false;

  return !!(iploggerServers.find((domain) => url.hostname.endsWith(domain)));
};

const checkIPLoggerRedirect = async (url) => {
  logger.debug(`IPLogger redirect check on ${url}`);

  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  const client = got.extend(
    {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8'
      }
    }
  );

  return client(url, {
    timeout: 10000,
    hooks: {
      beforeRedirect: [
        (options, response) => {
          const urlText = response.headers.location;
          if (!urlText) return;
          const url = parseUrlFromText(urlText);

          if (isIpLoggerUrl(url)) {
            throw new Error('ipLoggerRedirect');
          }
        }
      ]
    }
  });
}

const urlValidateFromContext = async (ctx, next) => {
  const { message } = ctx.update || { message: { text: '' } };
  const { text } = message;

  // skip processing if this looks like a bot command
  if (text.startsWith("/")) {
    return next();
  }

  return urlValidateFromMessage(ctx, message.text, next);
}

const urlValidateFromMessage = async (ctx, messageText, next) => {
//  const url = parseUrlFromText(messageText);
//  return urlValidateFromUrl(ctx, url, next);

  const urls = messageText.match(URL_EXTRACT_REGEX) || [];

  for (const url of urls) {
    const urlRef = new URL(url);
    await urlValidateFromUrl(ctx, urlRef, async () => {});
  }

  next();
}

const isFromChat = ctx => {
  return ctx.update && ctx.update.message.chat.id < 0;
}

const urlValidateFromUrl = async (ctx, url, next) => {
  const replyOps = { reply_to_message_id: ctx.message.message_id };

  if (!url) {
    // detect whether this is a private chat with a bot, or a message received in a chat
    if (isFromChat(ctx)) {
      // the message originates from a chat. silently return

      return next();
    }

    return ctx.reply(MSG_NOT_AN_URL);
  }

  if (isWhitelistedDomain(url)) {
    if (!isFromChat(ctx)) {
      await ctx.reply(MSG_LGTM, replyOps);
    }

    return next();
  }

  return easterEggsValidate(ctx, url, next);
}

module.exports = {
  urlValidateFromContext,
  urlValidateFromMessage,
  init
};
