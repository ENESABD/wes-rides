const jwt = require("jsonwebtoken");
require("dotenv").config();
const pool = require("../db");


module.exports = async function(req, res, next) {
    try {

        //capture token
        let token = req.header("jw_token");


        //check if token exists
        if (!token) {
            return res.status(401).json({ error: "Invalid link" });
        }


        //capture user ID from token
        let userID = JSON.parse(atob(token.split('.')[1])).user.id;


        //capture user password
        let user_password = await pool.query(
            "SELECT user_password FROM users WHERE user_id = $1",
            [userID]
        )


        //check if user password is captured
        if (user_password.rows.length === 0) {
            return res.status(400).json({ error: "Invalid user" });
        }


        //verify token
        const secret = process.env.jwtSecret + user_password.rows[0].user_password;
        const verify = jwt.verify(token, secret);


        //capture user information from the payload
        req.user = verify.user;

        next();
    } catch (err) {
        console.log(err.message);
        return res.status(401).json({ error: "Jwt is not valid" });
    }
}