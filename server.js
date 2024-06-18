// Importing required modules
const express = require('express');
const cors = require('cors');
const BaseReponse = require('./shared/BaseResponse');
const mysql = require('mysql2/promise');
const { Connector } = require('@google-cloud/cloud-sql-connector');
const bodyParser = require('body-parser');
const {generateUUID} =  require('./shared');
const stripe = require('stripe')('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');
const axios = require('axios');




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
  let data = await saveRegistration(payload);
  let response;
  if(data)
  response = new BaseReponse(null,true,'Success');
  else 
  response = new BaseReponse(null,false,'Failed');

  res.json(response);
});

//save patient info 
app.post('/patientInfo', async (req, res) => {
  let payload = req.body;
  console.log(payload);
  let data = await savePatient(payload);
  let response;
  if(data)
  response = new BaseReponse(data,true,'Success');
  else 
  response = new BaseReponse(null,false,'Failed');

  res.json(response);
});

//stripe function
app.post('/stripeCustomer', async (req, res) => {
  let customerBody = req.body;
  let stripeResponse = await createStripeCustomer(customerBody);
  (stripeResponse?.id) ? res.json(stripeResponse?.id) : res.json(null);
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
  let practiceid = generateUUID();
  let emailId = generateUUID();
  insertIdIntoTable('Practices','practiceid',practiceid)

  const insertQueryForDoctors = 'INSERT INTO Doctors ' +
    '(doctorid,firstname,lastname,specialtyid,cbctid,practiceid,doctoremail,registration) values (?, ?, ?, ?, ?, ?, ?, CURDATE())';
    try{
  await conn.execute(insertQueryForDoctors, [payload.doctorId, payload.dFirstName, payload.dLastName, payload.specialty, payload.cbct, practiceid, payload.emailId]);
    }
    catch(e){
      console.log(e);
    }
  

  const insertQueryForEmail = 'INSERT INTO Emails ' +'(emailid,practiceid,email) values (?, ?, ?)';
  try {
  await conn.execute(insertQueryForEmail, [emailId, practiceid, payload.email]);
  }
  catch(e){
    console.log(e);
  }

  const updateQueryForEmail = 'UPDATE Practices SET ' +
  'practicename = ?, mailingaddress = ?, state = ?, city = ?, zip = ?, ' +
  'phone = ?, practiceemail = ?, billingemail = ?, cbctid = ?, website = ?, address2 = ?, registration = CURDATE() ' +
  'WHERE practiceid = ?';
  const values = [
    payload.practice,
    payload.street,
    payload.state,
    payload.city,
    payload.zip,
    payload.practisePhoneNo,
    payload.emailId,
    payload.billEmail,
    payload.cbct,
    (payload?.website) ? payload.website : '',
    payload.address2,
    practiceid
  ];
    
  try {
    await conn.execute(updateQueryForEmail, values);
    console.log('practice updated successfully!');
  } catch (error) {
    console.error('Error updating practice:', error);
  }
  return true
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

  async function savePatient(payload) {

    let patientId = generateUUID();
    let caseId = generateUUID();
    insertIdIntoTable('Patients','patientid',patientId)
    insertIdIntoTable('Cases','caseid',caseId);
    let patientPayload = payload.patientInfo;
    let reasonPayload = payload.reasonInfo;
    let radiologistPayload = payload.radiologistInfo;
    let emailRelatedPayload = payload.emailRelatedData
    //patient age calculation
    let ageDifMs = Date.now() - new Date(patientPayload.birthDate)
    let ageDate = new Date(ageDifMs)
    let patientage = Math.abs(ageDate.getUTCFullYear() - 1970);


  //patient data 
  const updateQueryForPatient = 'UPDATE Patients ' +
  'SET doctorid=?, firstname=?, lastname=?, internalid=?, dob=?, sex=? ' +
  'WHERE patientid=?';
  const valuesForPatient = [
    patientPayload.doctorId,
    patientPayload.firstName,
    patientPayload.lastName,
    patientPayload.internalId,
    patientPayload.birthDate,
    patientPayload.sexType,
    patientId
  ];
    
  try {
    await conn.execute(updateQueryForPatient, valuesForPatient);
    console.log('patient info updated successfully!');
  } catch (error) {
    console.error('Error updating practice:', error);
  }

   // radiologist data
   const updateQueryForRadiologist = "UPDATE Cases SET " + 
   "patientid = ?, " +
   "patientage = ?, " +
   "radiologistid = ?, " +
   "rushcase = ?, " +
   "statcase = ?, " +
   "uploadperson = ?, " +
   "caseemail = ?, " +
   "submitted = CURRENT_TIMESTAMP() " +
   "WHERE caseid = ?";
   const valuesForRadiologist = [
     patientId,
     patientage,
     radiologistPayload.radioLogist,
     radiologistPayload.rush,
     radiologistPayload.stat,
     emailRelatedPayload.name,
     emailRelatedPayload.email,
     caseId
   ];

   try {
    await conn.execute(updateQueryForRadiologist, valuesForRadiologist);
    console.log('cases info updated successfully!');
  } catch (error) {
    console.error('Error updating cases:', error);
  }


  reasonPayload.forEach(reason => {
    let reasonId = generateUUID();
    reason.Id = reasonId;
    insertIdIntoTable('WhySubmitted','reasonid',reasonId)
  });

  reasonPayload.forEach(reason => {
     const updateQueryForReasons = "UPDATE WhySubmitted SET " + "caseid = ?, " + "reason = ?, " + "patdocnotes = ?" +" WHERE reasonid = ?"
     const valuesForReasons = [ caseId,reason.code,reason.desc,reason.Id];
     try {
       conn.execute(updateQueryForReasons, valuesForReasons);
      console.log('reason info updated successfully!');
    } catch (error) {
      console.error('Error updating reason:', error);
    }
    });

    const [patientDoctorData] = await conn.execute('SELECT Patients.firstname, Patients.lastname, Patients.internalid, Patients.dob, Patients.sex, Cases.uploadperson, Cases.caseemail, Cases.submitted, Doctors.firstname AS doctorfirstname, Doctors.lastname AS doctorlastname FROM Patients INNER JOIN Cases ON Patients.patientid = Cases.patientid INNER JOIN Doctors ON Patients.doctorid = Doctors.doctorid WHERE Patients.patientid = "18978e83-7b54-4738-98b4-02c83884ac41"',
     [patientId]);

     const [reasonData] = await conn.execute('SELECT WhySubmitted.patdocnotes,WhySubmitted.reason FROM WhySubmitted WHERE WhySubmitted.caseid = ?',
     [caseId]);

     const combinedData = {
      patientDoctorData,
      reasonData
    };
        return { data: combinedData };

}




///////////////////////////////**helper functions *//////////////////////////////////
// Function to create a customer on Stripe using async/await
const createStripeCustomer = async (customerData) => {
  try {
    const response = await axios.post('https://api.stripe.com/v1/customers', customerData, {
      headers: {
        'Authorization': `Bearer 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`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw error.response.data;
    } else {
      throw error.message;
    }
  }
};



