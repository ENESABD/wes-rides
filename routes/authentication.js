const express = require("express");
const router = express.Router();

const bcrypt = require("bcrypt");

const pool = require("../db");

const jwtGenerator = require("../utils/jwtGenerator");
const tokenSender = require("../utils/tokenSender");

const validUserInfo = require("../middleware/validUserInfo");
const authorize = require("../middleware/authorize");
const authorizePasswordReset = require("../middleware/authorizePasswordReset");
  


router.post("/register", validUserInfo, async (req, res) => {
  try {

    const { name, email, password, phone, facebook, instagram, snapchat } = req.body;

  
    //check if phone number (if entered) is unique 
    //(would give an error anyways but better to check in advance to not unnecessarily execute code below)
    if (phone) {  
      const alreadyExistent = await pool.query("SELECT * FROM users WHERE user_phone_number = $1", [
        phone
      ]);

      if (alreadyExistent.rows.length > 0) {
        return res.status(409).json({ error : 'User with this phone number already exists' });
      }
    }


    //check if email is unique
    //(same reasoning as phone number)
    const alreadyExistent = await pool.query("SELECT * FROM users WHERE user_email = $1", [
        email
      ]);
    
    if (alreadyExistent.rows.length > 0) {
      return res.status(409).json({ error : 'User with this email already exists' });
    }


    //hash the password
    const salt = await bcrypt.genSalt(10);
    const bcryptPassword = await bcrypt.hash(password, salt);


    //create new user in DB
    //(phone, facebook, instagram, snapchat are optional)
    let newUser = await pool.query(
      "INSERT INTO users (user_name, user_email, user_password, user_phone_number, user_facebook, user_instagram, user_snapchat) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [name.trim(), email, bcryptPassword, 
        (phone ? phone : null), 
        (facebook ? facebook.trim() : null), //whitespace is trimmed from the beginning and the end
        (instagram ? instagram.trim() : null), 
        (snapchat ? snapchat.trim() : null)]
    );


    //check if there was an error in the creation of a new entry in DB
    if (newUser.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid entry'});
    }

    newUser = newUser.rows[0];


    //generate a jwt
    const jwToken = jwtGenerator(newUser.user_id, process.env.jwtSecretExtension);


    //send a verification email
    tokenSender(email, jwToken, false);


    //return a success message
    return res.status(201).json({ success: true });

  } catch (err) {
    if (err.message === "data must be a string or Buffer and salt must either be a salt string or a number of rounds") {
      return res.status(400).json({ error: "Invalid entry" })
    } else{
      console.log(err.message);
      return res.status(500).json({ error: "Server error" });
    }
  }
});



router.post("/login", validUserInfo, async (req, res) => {
  try {

    const { email, password } = req.body;


    //check if user exists
    let user = await pool.query("SELECT * FROM users WHERE user_email = $1 ", 
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: "Email is not registered" });
    }

    user = user.rows[0];


    //check if password is valid
    const isValidPassword = await bcrypt.compare(
      password,
      user.user_password
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: "Wrong password" });
    }


    //check if the email is confirmed
    if (!user.confirmed) {
      return res.status(401).json({ error: "This user has not confirmed their email."})
    }


    //generate a jwt
    const jwToken = jwtGenerator(user.user_id);


    //return jwt
    return res.status(200).json({ jw_token: jwToken });

  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: "Server error 1", also: err.message });
  }
});



router.get("/verify", authorize, (req, res) => {
  try {

    //return success status, and true as an indication that the user is logged in
    return res.status(200).json(true);

  } catch (err) {
    return res.status(500).send({ error: "Server error" });
  }
});



router.get("/verify-r", authorizePasswordReset, (req, res) => {
  try {

    //return success status, and true
    return res.status(200).json(true);

  } catch (err) {
    return res.status(500).send({ error: "Server error" });
  }
});



router.post("/forgot-password", async (req, res) => {
  try {

    //capture email value
    const { email } = req.body;


    //check if user exists
    let user = await pool.query("SELECT * FROM users WHERE user_email = $1 ", 
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: "Email is not registered" });
    }

    user = user.rows[0];


    //check if the email is confirmed
    if (!user.confirmed) {
      return res.status(401).json({ error: "Email needs to be confirmed before requesting a password reset."})
    }


    //generate a jwt
    const jwToken = jwtGenerator(user.user_id, user.user_password);


    //send the password change link
    tokenSender(email, jwToken, true);


    //send a message
    return res.status(200).json({ success: true });

  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ error: err.message });
  }
});


module.exports = router;