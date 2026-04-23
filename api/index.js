const { app, ready } = require('../backend/src/index');

module.exports = async (req, res) => {
  await ready;
  return app(req, res);
};
