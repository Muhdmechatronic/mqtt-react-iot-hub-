const googleAuthService = require('../services/googleAuthService');

async function googleLogin(req, res) {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken is required' });

  try {
    const result = await googleAuthService.googleLogin(idToken);
    res.json(result);
  } catch (err) {
    console.error('[Google Auth]', err.message);
    res.status(401).json({ error: 'Google authentication failed. Please try again.' });
  }
}

module.exports = { googleLogin };
