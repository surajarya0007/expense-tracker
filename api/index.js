const { app, ready } = require('../backend/src/index');

module.exports = async (req, res) => {
  try {
    await ready;
    return app(req, res);
  } catch (err) {
    console.error('Vercel API Error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err.message
    });
  }
};
