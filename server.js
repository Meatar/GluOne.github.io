const express = require('express');
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

// Upsert user info in local DB
app.post('/users', async (req, res) => {
  try {
    const { username, email, is_premium, premium_expires_at } = req.body;
    await pool.execute(
      `INSERT INTO users (username, email, is_premium, premium_expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), is_premium=VALUES(is_premium), premium_expires_at=VALUES(premium_expires_at)`,
      [
        username,
        email,
        is_premium,
        premium_expires_at ? new Date(premium_expires_at) : null
      ]
    );
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove user from local DB
app.delete('/users', async (req, res) => {
  try {
    const { username } = req.body;
    await pool.execute(`DELETE FROM users WHERE username=?`, [username]);
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
