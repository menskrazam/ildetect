const { urlValidateFromMessage } = require("../tasks");

const command = async (ctx, next) => {
  const srcTelegramChatId = ctx.message.chat.id;
  const messageToCheck = ctx.message.reply_to_message;

  console.debug(`/check command received in ${srcTelegramChatId}`);

  if (!messageToCheck) {
    await ctx.reply("Эту команду нужно вызывать в ответ на сообщение с ссылкой");
  }

  return urlValidateFromMessage(ctx, messageToCheck.text, next);
}

module.exports = {
  command
}
