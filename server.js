const express = require('express');
const axios = require('axios');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'u3239193_default',
  password: 'LX59kglhVRs17i7R',
  database: 'u3239193_default'
});

// Ensure table exists
(async () => {
  const conn = await pool.getConnection();
  await conn.execute(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    email VARCHAR(255),
    is_premium BOOLEAN DEFAULT 0,
    premium_expires_at DATETIME
  )`);
  conn.release();
})().catch(err => console.error(err));

const api = axios.create({
  baseURL: 'https://api.gluone.ru'
});

function forwardCookies(apiRes, res) {
  const cookies = apiRes.headers['set-cookie'];
  if (cookies) {
    res.set('set-cookie', cookies);
  }
}

app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const apiRes = await api.post('/auth/web/register', { username, email, password }, {
      headers: { cookie: req.headers.cookie || '' }
    });
    forwardCookies(apiRes, res);
    const { is_premium, premium_expires_at } = apiRes.data;
    await pool.execute(
      `INSERT INTO users (username, email, is_premium, premium_expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), is_premium=VALUES(is_premium), premium_expires_at=VALUES(premium_expires_at)`,
      [username, email, is_premium, premium_expires_at ? new Date(premium_expires_at) : null]
    );
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).send(e.response?.data || { error: e.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const apiRes = await api.post('/auth/web/login', { username, password }, {
      headers: { cookie: req.headers.cookie || '' }
    });
    forwardCookies(apiRes, res);
    const { is_premium, premium_expires_at } = apiRes.data;
    await pool.execute(
      `UPDATE users SET is_premium=?, premium_expires_at=? WHERE username=?`,
      [is_premium, premium_expires_at ? new Date(premium_expires_at) : null, username]
    );
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).send(e.response?.data || { error: e.message });
  }
});

app.post('/auth/refresh', async (req, res) => {
  try {
    const apiRes = await api.post('/auth/web/refresh', {}, {
      headers: { cookie: req.headers.cookie || '' }
    });
    forwardCookies(apiRes, res);
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).send(e.response?.data || { error: e.message });
  }
});

app.post('/auth/logout', async (req, res) => {
  try {
    const apiRes = await api.post('/auth/web/logout', {}, {
      headers: { cookie: req.headers.cookie || '' }
    });
    forwardCookies(apiRes, res);
    res.status(204).send();
  } catch (e) {
    res.status(e.response?.status || 500).send(e.response?.data || { error: e.message });
  }
});

app.post('/auth/change-password', async (req, res) => {
  try {
    const apiRes = await api.post('/auth/web/change-password', req.body, {
      headers: { cookie: req.headers.cookie || '' }
    });
    forwardCookies(apiRes, res);
    res.status(apiRes.status).send(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).send(e.response?.data || { error: e.message });
  }
});

app.post('/auth/delete', async (req, res) => {
  try {
    const { username } = req.body;
    const apiRes = await api.post('/auth/web/delete', req.body, {
      headers: { cookie: req.headers.cookie || '' }
    });
    forwardCookies(apiRes, res);
    await pool.execute(`DELETE FROM users WHERE username=?`, [username]);
    res.status(apiRes.status).send(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).send(e.response?.data || { error: e.message });
  }
});

app.get('/auth/me', async (req, res) => {
  try {
    const apiRes = await api.get('/auth/me', {
      headers: { authorization: req.headers.authorization }
    });
    res.json(apiRes.data);
  } catch (e) {
    res.status(e.response?.status || 500).send(e.response?.data || { error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
