const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.get('/check-db', async (req, res) => {
  // Allow overriding connection settings via environment variables so the
  // application can connect to the local database by default but still be
  // configurable in different environments.
  const connectionConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'u3239193_default',
    password: process.env.DB_PASSWORD || 'LX59kglhVRs17i7R',
    database: process.env.DB_NAME || 'u3239193_default',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
  };

  try {
    const connection = await mysql.createConnection(connectionConfig);
    const [rows] = await connection.query('SHOW TABLES');
    await connection.end();
    const tables = rows.map(row => Object.values(row)[0]);
    res.json({ success: true, tables });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || err.code });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Server running on port ${port}`));
