// Importing required modules
const express = require('express');
const cors = require('cors');
const BaseReponse = require('./shared/BaseResponse');
const mysql = require('mysql2/promise');
const { Connector } = require('@google-cloud/cloud-sql-connector');
const bodyParser = require('body-parser');
const {generateUUID} =  require('./shared');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {Storage} = require('@google-cloud/storage');


// Create the /images directory if it doesn't exist
const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

// Set up multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const originalName = file.originalname.split('.')[0]; // Get the name without extension
    const extension = path.extname(file.originalname); // Get the extension
    const newFilename = `${originalName}${extension}`;
    cb(null, newFilename);
  }
});

const keyFilePath = path.join(__dirname, 'mainframe-312100-f1018c69e912.json');


const upload = multer({ storage: storage });
const _storage = new Storage({
  keyFilename: keyFilePath,
});



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
app.listen(port, async () => {
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

app.post('/uploadFiles',upload.array('files'), async (req, res) => {
  let response = new BaseReponse(null,true,'Success');
  res.json(response);
});

//make bucket
app.get('/makeBucket',async (req, res) => {
  let practiceId = req.query.practiceId;
  await makeBucketIfNot(practiceId);
  response = new BaseReponse(null,true,'Success');
  res.json(express.response);
});

//upload items bucket
app.get('/uploadToBucket',async (req, res) => {
  let practiceId = req.query.practiceId;
  let patientId = req.query.patientId;
  await uploadItemsToBucket(practiceId,patientId);
  response = new BaseReponse(null,true,'Success');
  res.json(express.response);
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

app.post('/stripeCustomer', async (req, res) => {
  let customerBody = req.body;
  let practiceId = customerBody?.practiceid;
  let stripeResponse = await createStripeCustomer(customerBody);
  if(stripeResponse?.id) {
    if(practiceId) updateIntoTable('Practices','customerid',stripeResponse?.id,`practiceid = '${practiceId}'`);
    res.json(stripeResponse?.id);
  }
  else res.json(null);
});

app.post('/setupIntentStripe', async (req, res) => {
  let body = req.body;
  let stripeResponse = await createStripeIntentCall(body);
  let Finalresponse = new BaseReponse(stripeResponse,true,'Success');
  res.json(Finalresponse);
});

app.get('/fetchSetupIntent', async (req, res) => {
  let Id = req.intentId;
  let setupIntent = await fetchSetupIntent(Id);
  let Finalresponse = new BaseReponse(setupIntent,true,'Success');
  res.json(Finalresponse);
});

app.get('/updatePayment', async (req, res) => {
  let intentId = req.query.intentId;
  if(intentId) {
    let setupIntent = await fetchSetupIntent(intentId);
    if(setupIntent?.Id) await makePayment(setupIntent.paymentMethod,setupIntent.customer)
  }
  let practiceId = req.query.practiceId;
  updateIntoTable('Practices','payment',1,`practiceid = '${practiceId}'`);
  let Finalresponse = new BaseReponse(stripeResponse,true,'Success');
  res.json(Finalresponse);
});

app.get('/makePayment', async (req, res) => {
  let intentId = req.query.intentId;
  let responseOfPaymentIntent;
    let setupIntent = await fetchSetupIntent(intentId);
    if(setupIntent?.Id) responseOfPaymentIntent = await makePayment(setupIntent.paymentMethod,setupIntent.customer);
    if(responseOfPaymentIntent?.data?.status == 'requires_payment_method' || responseOfPaymentIntent?.data?.status == 'failed'){
      let Finalresponse = new BaseReponse({},false,'Success');
      res.json(Finalresponse);
    }
    else {
      let Finalresponse = new BaseReponse({},true,'Success');
      res.json(Finalresponse);
    }
});

//save patient info 
app.get('/callCaptcha', async (req, res) => {
  let token = req.query.token;
  let captchaResult =  await callCaptchaFunc(token);
  let Finalresponse = new BaseReponse(captchaResult,true,'Success');
  res.json(Finalresponse);
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
      // const [practiceRows] = await conn.execute(
      //   `SELECT Doctors.doctorid, Doctors.firstname, Doctors.lastname, Practices.practicename, Practices.practiceid, Practices.payment, Practices.billingemail,Practices.paymentmethodid
      //    FROM Practices
      //    INNER JOIN Doctors ON Doctors.practiceid = Practices.practiceid
      //    WHERE Practices.practiceid = ?`, [practiceId]);
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

async function updateIntoTable(tableName, columnName, value, whereClause) {
  try {
    const updateQuery = 'UPDATE ' + tableName + ' SET ' + columnName + ' = ? WHERE ' + whereClause;
    await conn.execute(updateQuery, [value]);
  }
  catch(err){
    console.log(err);
  }
}


  async function savePatient(payload) {

    let caseId = generateUUID();
    insertIdIntoTable('Patients','patientid',patientInfo.Id)
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
    if(customerData?.practiceid) delete customerData.practiceid;
    const response = await axios.post('https://api.stripe.com/v1/customers', customerData, {
      headers: {
        'Authorization': `Bearer rk_test_51DbxG7EkvGHbgUsIxH0YqmCCkZ9GYm9hdFRZWZPxN5tLutB37XVHwpHQwpvrrTXoaz0Rob38PMdVtC7HWLgzTCHE004ctwLfLH`,
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

const createStripeIntentCall = async (body) => {
    const response = await axios.post('https://api.stripe.com/v1/setup_intents', body, {
      headers: {
        'Authorization': `Bearer rk_test_51DbxG7EkvGHbgUsIxH0YqmCCkZ9GYm9hdFRZWZPxN5tLutB37XVHwpHQwpvrrTXoaz0Rob38PMdVtC7HWLgzTCHE004ctwLfLH`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
      return response.data;
};


const callCaptchaFunc = async (token) => {
  const secret = '6LcnQWMeAAAAAO96ppUEGXshg1UeKMNht-hEMCTe';
  const recaptchaBody = {
    secret: secret,
    response: token
  };

  try {
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      new URLSearchParams(Object.entries(recaptchaBody)).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.success;
  } catch (error) {
    console.error('Error making the HTTP call:', error);
    throw error;
  }
};

  const makePayment = async (paymentMethod,customer) => {
    try {
      const paymentIntentData = {
        amount: 5000, 
        currency: 'usd',
        customer: customer,
        payment_method: paymentMethod,
        off_session: true, 
        confirm: true
      };
      
      const response = await axios.post('https://api.stripe.com/v1/payment_intents', paymentIntentData, {
        headers: {
          'Authorization': `Bearer rk_test_51DbxG7EkvGHbgUsIxH0YqmCCkZ9GYm9hdFRZWZPxN5tLutB37XVHwpHQwpvrrTXoaz0Rob38PMdVtC7HWLgzTCHE004ctwLfLH`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        console.error('Error Response:', error.response.data); // Logs specific error data
        throw error.response.data;
      } else {
        console.error('Error Message:', error.message); // Logs error message
        throw error.message;
      }
    }
  };

  const fetchSetupIntent = async (Id) => {
    const response = await axios.get(`https://api.stripe.com/v1/setup_intents/${Id}`, {
      headers: {
        'Authorization': `Bearer rk_test_51DbxG7EkvGHbgUsIxH0YqmCCkZ9GYm9hdFRZWZPxN5tLutB37XVHwpHQwpvrrTXoaz0Rob38PMdVtC7HWLgzTCHE004ctwLfLH`,
      },
    });
    return response ?? {}
  };

   const makeBucketIfNot =  async (name) => {
     try{
      const [bucket] = await _storage.createBucket(name,{
        location: 'us-west3', 
        storageClass: 'STANDARD',
        iamConfiguration: {
          uniformBucketLevelAccess: {
            enabled: true,
          },
        },
        hierarchicalNamespace: {
          enabled: true,
        },
        lifecycle: {
          rule: [
            {
              action: {
                type: 'SetStorageClass',
                storageClass: 'ARCHIVE', // Transition to Archive storage class
              },
              condition: { age: 6 }, // Transition objects to Archive after 5 days
            },
            {
              action: { type: 'Delete' },
              condition: { age: 4001 },
            },
          ],
        },
      });
      console.log('a bucket has been made!',name)
    } catch (err) {
      console.error('ERROR:', err);
    }
  }

  const uploadItemsToBucket = async (practiceId,patientId) => {

    try {
      const [bucket] = await _storage.bucket(practiceId).get();
      const imagesDir = path.join(__dirname, 'images'); 
      const files = fs.readdirSync(imagesDir);

      const uploadPromises = files.map(file => {
        const filePath = path.join(imagesDir, file); 
        const destination = `${patientId}/${file}`; 
        return bucket.upload(filePath, { destination });
      });
      
      await Promise.all(uploadPromises);
      console.log('uploaded to bucket.All files');
      deleteImages();
      } catch (error) {
      console.error('Error uploading file to bucket:', error);
    }
  }

  const deleteImages = () => {
    const folderPath = path.join(__dirname, 'images'); // Adjust the path as needed

    fs.readdir(folderPath, (err, files) => {
    if (err) {
        console.error('Error reading the directory:', err);
        return;
    }

    files.forEach(file => {
        const filePath = path.join(folderPath, file);
        
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`Error deleting file ${file}:`, err);
            } else {
                console.log(`Deleted file: ${file}`);
            }
        });
    });
});
}


