require('dotenv').config();
const got = require('got');
const eggs = require('./easterEggsDomains.json');
const iploggerServers = require('./iploggerDomains.json');
const lookup = require('safe-browse-url-lookup');

// Init google safe browser
const googleLookup = lookup({ apiKey: process.env.GOOGLE_API_KEY });

// Generate pattern string for iplogger domains validation
const iploggerServersPattern = `(${iploggerServers.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;

// Parse text message to URL object
const parseTextToUrl = (ctx) => {
  const { message } = ctx.update || { message: { text: '' } };
  const { text } = message;
  const normalizedText = !text ? '' : text.trim().toLowerCase();
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

  if (iploggerServers.filter((domain) => url.hostname.endsWith(domain)).length > 0) {
    return ctx.reply('Да, это оно! Палёночка! Свежая! Губошлепами запахло! Не открывайте эту ссылку! Она сопрет IP адрес.');
  }

  let hasILLinks = false;
  let hasRedirect = false;
  let hasError = false;
  let hasErrorCode = false;
  let response = false;
  ctx.reply('Снаружи вроде как всё прилично... Посмотрим что там внутри, есть ли iplogger. Может занять немножко времени.');

  try {
    response = await got(url.toString(), {
      timeout: 10000,
      hooks: {
        beforeRedirect: [
          () => {
            hasRedirect = true;
          }
        ]
      }
    });
  } catch (error) {
    hasError = true;
    hasErrorCode = error.response && error.response.statusCode ? error.response.statusCode : false;
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
  if (hasRedirect) {
    ctx.reply('Какой то странный редирект у этой ссылочки. Но в остальном от iplogger вроде бы безопасна. Но кто знает, что еще они придумают, лучше не переходить ни по каким ссылкам и пользоваться VPN и постоянно проверять список подключенных в телегу устройств.');
  } else {
    ctx.reply('Эта ссылка вроде как не iplogger. От этой гадости она безопасна. Но всё равно, кто знает, что еще они придумают, лучше не переходить ни по каким ссылкам и пользоваться VPN и постоянно проверять список подключенных в телегу устройств.');
  }

  return googleSafeBrowsingValidate(ctx, next, url);
}

module.exports = async (ctx, next) => {
  const url = parseTextToUrl(ctx);
  if (!url) {
    return ctx.reply('А это вы правда ссылку ща ввели? Я чет разобрать не смог.');
  }
  ctx.reply('Итак, посмотрим, что тут за ссылочка...');
  return easterEggsValidate(ctx, next, url);
};
