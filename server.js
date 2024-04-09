// Importing required modules
const express = require('express');
const cors = require('cors');
const BaseReponse = require('./shared/BaseResponse');
const mysql = require('mysql2/promise');
const { Connector } = require('@google-cloud/cloud-sql-connector');
const bodyParser = require('body-parser');
const {generateUUID} =  require('./shared')



// Creating an instance of Express
const app = express();
const port = 3000; // on default it is this.
let conn;
app.use(cors({
  origin: 'http://localhost:4200',
  methods: 'POST,GET,PUT,OPTIONS,DELETE'
}));
app.use(bodyParser.json());




// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
// start db server
startDBInstance();


//event listener server
app.on('close',async () => {
  await pool.end();
  connector.close();
});


//////////////////* Endpoints ** /////////////////
//check email from db
app.get('/checkEmailDB', async (req, res) => {
  let email = req.query.email;
  let response;
  if(!email){
    response = new BaseReponse(false,true,'Email is empty');
  }
  else{
  let emailData = await checkEmailExists(email)
   response = new BaseReponse(emailData,true,emailData?.length ? 'Email found': 'Email not found');
  }
  res.json(response);
});

//check match practice from db
app.post('/checkMatchPractice', async (req, res) => {
  let payload = req.body;
  let data = await checkMatchPracticeLogic(payload);
  let response = new BaseReponse(data,true,'Success');
  res.json(response);
});

//check match practice from db
app.post('/saveRegistration', async (req, res) => {
  let payload = req.body;
  console.log(payload)
  // let data = await saveRegistration(payload);
  // let response = new BaseReponse(data,true,'Success');
  // res.json(response);
});





///////////////////db functions//////////////////

async function startDBInstance(){
// db configs
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
 conn = await pool.getConnection();
 console.log('connection secured.')
}

async function checkEmailExists(email) {
    // Query the database to check if the email exists
    const [rows] = await conn.execute('SELECT practiceid FROM Emails WHERE email = ?', [email]);
    if (rows.length > 0) {
      const practiceId = rows[0].practiceid;

      // Query to fetch data related to the practice
      const [practiceRows] = await conn.execute(
        `SELECT Doctors.doctorid, Doctors.firstname, Doctors.lastname, Practices.practicename, Practices.practiceid, Practices.payment, Practices.billingemail
         FROM Practices
         INNER JOIN Doctors ON Doctors.practiceid = Practices.practiceid
         WHERE Practices.practiceid = ?`, [practiceId]);
      // Return the fetched data
      return practiceRows;
    }
    else return null;
}

async function checkMatchPracticeLogic(payload) {
    const query = "SELECT practiceid FROM Practices WHERE practicename = ? AND state = ?";
    const [resultRows] = await conn.execute(query, [payload.practiceName, payload.stateName]);
    if(resultRows?.length){
        let practiceid = resultRows[0].practiceid;
        if(practiceid){
        const insertQuery = 'INSERT INTO Emails (emailid, practiceid, email) VALUES (?, ?, ?)';
        await conn.execute(insertQuery, [payload.emailId, practiceid, payload.emailName]);
    }

  let resulantData = null;
  if(practiceid){
    const query = `
    SELECT Doctors.doctorid, Doctors.firstname, Doctors.lastname, 
           Practices.practicename, Practices.practiceid, Practices.payment, Practices.billingemail 
    FROM Practices 
    INNER JOIN Doctors ON Doctors.practiceid = Practices.practiceid 
    WHERE Practices.practiceid = ?`;
  resulantData = await conn.execute(query, [practiceid]);
  }
  return resulantData[0];
  }
}

async function saveRegistration(payload) {
  let doctorId = generateUUID();
  let practiceid = generateUUID();
  insertIdIntoTable('Practices','practiceid',practiceid)

  const insertQueryForDoctors = 'INSERT INTO Doctors ' +
    '(doctorid,firstname,lastname,specialtyid,cbctid,practiceid,doctoremail,registration) values (?, ?, ?, ?, ?, ?, ?, CURDATE())';
  await conn.execute(insertQueryForDoctors, [doctorId, payload.dFirstName, payload.dLastName, payload.specialty, payload.cbct, payload.practiceid, payload.emailId]);
  

  let emailId = generateUUID();
  const insertQueryForEmail = 'INSERT INTO Emails ' +'(emailid,practiceid,email) values (?, ?, ?)';
  await conn.execute(insertQueryForEmail, [emailId, practiceid, payload.email]);

  const updateQueryForEmail = 'UPDATE Practices SET ' +
  'practicename = ?, mailingaddress = ?, state = ?, city = ?, zip = ?, ' +
  'phone = ?, practiceemail = ?, billingemail = ?, cbctid = ?, website = ?, address2 = ?, registration = CURDATE() ' +
  'WHERE practiceid = ?';
  const values = [
    payload.practicename,
    payload.mailingaddress,
    payload.state,
    payload.city,
    payload.zip,
    payload.phone,
    payload.practiceemail,
    payload.billingemail,
    payload.cbctid,
    payload.website,
    payload.address2,
    practiceid
  ];
    
  try {
    await conn.execute(updateQueryForEmail, values);
    console.log('practice updated successfully!');
  } catch (error) {
    console.error('Error updating practice:', error);
  }
}

async function insertIdIntoTable(tableName, columnName, value) {
  try {
    const insertQueryForEmail = 'INSERT INTO ' + tableName + ' (' + columnName + ') VALUES (?)';
    await conn.execute(insertQueryForEmail, [value]);
  }
  catch(err){
    console.log(err);
  }

}


