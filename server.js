// Simple express server that serves static files and exposes
// a small API for creating Tinkoff payment sessions.
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Serve static assets for any other routes.
app.use(express.static(__dirname));

// --- Payment API ---------------------------------------------------------
// Mapping between plan identifiers and price in kopecks
const PLAN_PRICES = {
  month: 9900, // 99.00 RUB
  quarter: 27900, // 279.00 RUB
  half: 49900, // 499.00 RUB
  year: 89900 // 899.00 RUB
};

// Helper for building the token according to Tinkoff documentation
function generateToken(params, password) {
  const ordered = Object.keys(params)
    .sort()
    .map((k) => params[k])
    .join('');
  return crypto
    .createHash('sha256')
    .update(ordered + password)
    .digest('hex');
}

// Endpoint to initialise payment
app.post('/api/create-payment', async (req, res) => {
  const { plan } = req.body;
  const amount = PLAN_PRICES[plan];
  if (!amount) {
    return res.status(400).json({ error: 'Unknown plan' });
  }

  const payload = {
    TerminalKey: process.env.TINKOFF_TERMINAL_KEY || 'TinkoffBankTest',
    Amount: amount,
    OrderId: Date.now().toString(),
    Description: `GluOne subscription: ${plan}`,
    SuccessURL: 'https://gluone.ru/profile.html',
    FailURL: 'https://gluone.ru/profile.html'
  };

  // Use the password from env or test password
  const password = process.env.TINKOFF_PASSWORD || 'TinkoffBankTest';
  payload.Token = generateToken(payload, password);

  try {
    const { data } = await axios.post(
      'https://securepay.tinkoff.ru/v2/Init',
      payload
    );
    res.json(data);
  } catch (err) {
    console.error('Payment init failed', err.message);
    res.status(500).json({ error: 'Payment init failed' });
  }
});

// -------------------------------------------------------------------------

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));
