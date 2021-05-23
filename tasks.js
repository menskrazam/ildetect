require('dotenv').config();
const got = require('got');
const eggs = require('./easterEggsDomains.json');
const iploggerServers = require('./iploggerDomains.json');
const lookup = require('safe-browse-url-lookup');
const userAgents = require('./userAgents.json')

// Init google safe browser
const googleLookup = lookup({ apiKey: process.env.GOOGLE_API_KEY });

// Generate pattern string for iplogger domains validation
const iploggerServersPattern = `(${iploggerServers.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;

// Parse text message to URL object
const parseUrlFromCtx = (ctx) => {
  const { message } = ctx.update || { message: { text: '' } };
  const { text } = message;
  return parseUrlFromText(text);
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

// Easter effs validator
const easterEggsValidate = async (ctx, next, url) => {
  if (eggs.filter((domain) => url.hostname.endsWith(domain)).length > 0) {
    return ctx.reply('А вот грязь в меня попрошу не кидать! Я к этим доменам не прикоснусь!');
  }
  return iploggerValidate(ctx, next, url);
}

// Google Safe Browsing APIs (v4) validator
const googleSafeBrowsingValidate = async (ctx, next, url) => {
  ctx.reply('А что гугл думает про эту ссылку? У него инфы про гадости много, ща тож спросим.');

  let checkOnGoogle = false;
  try {
    checkOnGoogle = await googleLookup.checkSingle(url.toString());
  } catch (error) {
    ctx.reply('Попытался спросить у Гугла, что его безопасность о ссылке думает - молчит собака... Ошибка связи какая то. Ябатьки канал что ли перегрызли?');
    return next();
  }

  if (checkOnGoogle) {
    return ctx.reply('Гугл говорит, что это дрянь какая то, которую открывать НЕЛЬЗЯ!');
  }

  ctx.reply('Гугл говорит, что всё ок. Но если честно - это от обычных угроз ок. От кражи адреса всё равно никто не застрахован, мало ли какие еще способы они выдумают. Лучше вообще ничего из телеги не открывать на самом деле. Вот добавим еще и антивирусные проверки, вот заживем... Но все равно! Надо помнить - лучший способ защититься - не переходить по ссылкам!');
  return next();
}

// IPLogger validator
const iploggerValidate = async (ctx, next, url) => {
  ctx.reply('Глянем iplogger для начала. Губошлепы любят его использовать.');

  if (isIpLoggerUrl(url)) {
    return ctx.reply('Да, это оно! Палёночка! Свежая! Губошлепами запахло! Не открывайте эту ссылку! Она сопрет IP адрес.');
  }

  let hasILLinks = false;
  let hasIlRedirect = false;
  let hasError = false;
  let hasErrorCode = false;
  let response = false;
  ctx.reply('Снаружи вроде как всё прилично... Посмотрим что там внутри, есть ли iplogger. Может занять немножко времени.');

  try {
    response = await fetchPage(url.toString());
  } catch (error) {
    hasError = true;
    hasErrorCode = error.response && error.response.statusCode ? error.response.statusCode : false;
    hasIlRedirect = error.message === 'ipLoggerRedirect';
  }

  if (hasIlRedirect) {
    return ctx.reply('Да, это оно! Палёночка! Свежая! Губошлепами запахло! Не открывайте эту ссылку! Она сопрет IP адрес.');
  }

  if (hasError && hasErrorCode && hasErrorCode === 404) {
    return ctx.reply('Ммм... Сервер то я нашел, но он мамой клянется, что такой страницы у него нет. Обманывает небось, но я не могу проверить эту ссылку в результате.');
  }

  if (hasError && hasErrorCode) {
    return ctx.reply('Мммм... Сервер то я нашел, но он по этой ссылке ничего толком не отдает и бормочет что то невразумительное. Обманывает небось, но я не могу проверить эту ссылку в результате.');
  }

  if (hasError) {
    return ctx.reply('Мммм... Слууушай, что то я такой ссылки вообще не нахожу, ничего для анализа загрузить не получилось :( Она вообще существует? Я туда ору - а оттуда никто не отвечает. :(');
  }

  try {
    hasILLinks = new RegExp(iploggerServersPattern, 'i').test(response.body);
  } catch (error) {}

  if (hasILLinks) {
    return ctx.reply('Да, это оно! Палёночка! Свежая! Губошлепами запахло! Не открывайте эту ссылку! Она сопрет IP адрес.');
  }

  // If all ok
  ctx.reply('Эта ссылка вроде как не iplogger. От этой гадости она безопасна. Но всё равно, кто знает, что еще они придумают, лучше не переходить ни по каким ссылкам и пользоваться VPN и постоянно проверять список подключенных в телегу устройств.');

  return googleSafeBrowsingValidate(ctx, next, url);
}

const isIpLoggerUrl = (url) => {
  if (!url) return false;

  return !!(iploggerServers.find((domain) => url.hostname.endsWith(domain)));
};

const fetchPage = async (url) => {
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

const urlValidate = async (ctx, next) => {
  const url = parseUrlFromCtx(ctx);
  if (!url) {
    return ctx.reply('А это вы правда ссылку ща ввели? Я чет разобрать не смог.');
  }
  ctx.reply('Итак, посмотрим, что тут за ссылочка...');
  return easterEggsValidate(ctx, next, url);
}

module.exports = {
  urlValidate
};
