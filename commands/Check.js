const command = async (ctx, next) => {
  const srcTelegramChatId = ctx.message.chat.id;

  console.debug(`/check command received in ${srcTelegramChatId}`);

  return next();
}

module.exports = {
  command
}
