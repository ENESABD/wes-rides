const jwt = require("jsonwebtoken");
//require("dotenv").config();

function jwtGenerator(user_id, extraSecret) {
  const payload = {
    user: {
      id: user_id //// potential changes
    }
  };
  
  //if user password is provided, use it in jwt
  let secret;
  if (extraSecret) {
    secret = process.env.jwtSecret + extraSecret;
  } else {
    secret = process.env.jwtSecret;
  }
  
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}

module.exports = jwtGenerator;