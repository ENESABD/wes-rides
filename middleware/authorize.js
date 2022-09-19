const jwt = require("jsonwebtoken");
require("dotenv").config();


module.exports = function(req, res, next) {
  //Get jwt from header
  const token = req.header("jw_token");

  //Check if there is a jwt
  if (!token) {
    return res.status(401).json({ error: "No jwt" });
  }

  //Verify token
  try {
    //check if jwt is valid
    const verify = jwt.verify(token, process.env.jwtSecret);

    //capture user information form the payload
    req.user = verify.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Jwt is not valid" });
  }
};