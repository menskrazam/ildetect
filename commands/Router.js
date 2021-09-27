const Check = require("./Check");

const init = (log, bot) => {
  Check.init(log);

  bot.command("check", Check.command);
}

module.exports = {
  init
}
