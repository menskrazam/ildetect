const ngrok = require("ngrok");
const uuid = require("uuid");

const MODE_DEV = 'dev';
const MODE_PROD = 'production';
const serverUrl = process.env.SERVER_URL ? process.env.SERVER_URL.replace(/\/$/, "") : "";

const init = async (bot, mode) => {
  const endpoint = uuid.v4();

  switch (mode) {
    case MODE_PROD: {
      if (!process.env.SERVER_URL) {
        throw new Error('SERVER_URL must be provided!');
      }

      if (!process.env.PORT) {
        throw new Error('PORT must be provided!');
      }

      const port = process.env.PORT;

      return {
        url: `${serverUrl}:${port}/${endpoint}`,
        endpoint,
        port
      }
    }
    case MODE_DEV:
    default:
    {
      const url = await ngrok.connect(8080);
      return {
        url,
        endpoint,
        port: 8080
      }
    }
  }
}

module.exports = {
  init,
  MODE_DEV,
  MODE_PROD
}
