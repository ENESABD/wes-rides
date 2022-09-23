const jwt = require("jsonwebtoken");
require("dotenv").config();


module.exports = function(req, res, next) {
  //Get jwt from header or from parameters

  let token;
  let secret;

  if (req.path.substr(0,19) === "/email-verification") {
    token = req.params.token;
    secret = process.env.jwtSecret + process.env.jwtSecretExtension;
  } else {
    token = req.header("jw_token");
    secret = process.env.jwtSecret;
  }

  //Check if there is a jwt
  if (!token) {
    return res.status(401).json({ error: "No jwt" });
  }

  //Verify token
  try {
    //check if jwt is valid
    const verify = jwt.verify(token, secret);

    //capture user information from the payload
    req.user = verify.user;
    next();
  } catch (err) {
    console.log(err.message);

    //check if password reset is made through emailed link
    if (req.path.substr(0,9) === "/password") {
      next();
    }
    else {
      return res.status(401).json({ error: "Jwt is not valid" });
    }
  }
};