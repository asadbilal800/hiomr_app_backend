// Importing required modules
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const { Connector } = require('@google-cloud/cloud-sql-connector');


// Creating an instance of Express
const app = express();
const port = 3000; // on default it is this.

app.use(cors({
  origin: 'http://localhost:4200',
  methods: 'POST,GET,PUT,OPTIONS,DELETE'
}));

// Define the /checkEmail endpoint
app.get('/checkEmailDB', async (req, res) => {
    console.log(req.query.id);
    console.log('fight.')
    res.json({ message: 'Email not found from server' });
  });
 
 
 



// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

async function main() {
  const connector = new Connector();
  const clientOpts = await connector.getOptions({
    instanceConnectionName: 'mainframe-312100:us-west3:database',
    ipType: 'PUBLIC',
  });
  const pool = await mysql.createPool({
    ...clientOpts,
    user: 'asad',
    password: 'TbqFxKQd4!z%nrj',
    database: 'production_image_omr',
  });
  const conn = await pool.getConnection();
  const [result] = await conn.query(`SELECT * from Emails`);
  console.table(result); // prints returned time value from server

  await pool.end();
  connector.close();
}

