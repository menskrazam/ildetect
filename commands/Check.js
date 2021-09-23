const Validator = require("../Validator");

let logger;

const init = (log) => {
  logger = log;
}

const command = async (ctx, next) => {
  const srcTelegramChatId = ctx.message.chat.id;
  const messageToCheck = ctx.message.reply_to_message;

  logger.debug(`/check command received in ${srcTelegramChatId}`);

  if (!messageToCheck) {
    await ctx.reply("Эту команду нужно вызывать в ответ на сообщение с ссылкой");
  }

  return Validator.urlValidateFromMessage(ctx, messageToCheck.text, next);
}

module.exports = {
  init,
  command
}
