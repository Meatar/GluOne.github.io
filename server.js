const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.get('/check-db', async (req, res) => {
  const connectionConfig = {
    host: 'localhost',
    user: 'u3239193_default',
    password: 'LX59kglhVRs17i7R',
    database: 'u3239193_default'
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
