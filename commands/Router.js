const Check = require("./Check");

const init = (bot) => {
  bot.command("check", Check.command);
}

module.exports = {
  init
}
