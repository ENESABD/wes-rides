const router = require("express").Router();
const authorize = require("../middleware/authorize");
const validUserInfo = require("../middleware/validUserInfo");
const pool = require("../db");
const bcrypt = require("bcrypt");



router.get("/:id", authorize, async (req, res) => {
    try {
        const { id } = req.params;

        //check if current user info is requested
        let userID;

        if (id === '0') {
            userID = req.user.id;
        } else {
            userID = id;
        }
        
        //get user info from DB
        let user = await pool.query( 
            "SELECT user_name, user_email, user_phone_number, user_facebook, user_instagram, user_snapchat FROM users WHERE user_id = $1",
            [userID]
        );

        //check if user ID is valid
        if (user.rows.length === 0) {
            return res.status(400).json({ error: "Invalid user ID" });
          }

        user = user.rows[0];

        //return user
        return res.status(200).json(user);
    } catch (err) {
        if (err.message.substr(0, 34) === "invalid input syntax for type uuid") {
            return res.status(400).json({ error: "Invalid user ID"})
        }

        return res.status(500).json({ error: "Server error" });
    }
});


router.put("/", [validUserInfo, authorize], async (req, res) => {
    try {
        
        //capture any entered attributes
        const { name, email, phone, facebook, instagram, snapchat, password } = req.body;

        if (password || password === null || password === "") {
            return res.status(400).json({ error: "password cannot be changed here; no updates were made" })
        }

        //check which attributes are provided, and update them accordingly
        let user_attribute = null;

        if (name) {
            user_attribute = await pool.query(
                "UPDATE users SET user_name = $1 WHERE user_id = $2",
                [name, req.user.id]
            );
        }

        if (email) {
            user_attribute = await pool.query(
                "UPDATE users SET user_email = $1 WHERE user_id = $2",
                [email, req.user.id]
            );
        }

        if (phone || phone === null) {
            user_attribute = await pool.query(
                "UPDATE users SET user_phone_number = $1 WHERE user_id = $2",
                [phone, req.user.id]
            );
        }

        if (facebook || facebook === null) {
            user_attribute = await pool.query(
                "UPDATE users SET user_facebook = $1 WHERE user_id = $2",
                [facebook, req.user.id]
            );
        }

        if (instagram || instagram === null) {
            user_attribute = await pool.query(
                "UPDATE users SET user_instagram = $1 WHERE user_id = $2",
                [instagram, req.user.id]
            );
        }

        if (snapchat || snapchat === null) {
            user_attribute = await pool.query(
                "UPDATE users SET user_snapchat = $1 WHERE user_id = $2",
                [snapchat, req.user.id]
            );
        }

        //check if no attribute was provided
        if (!user_attribute) {
            return res.status(400).json({ error: "Missing information" });
        }

        //check if user was updated
        if (user_attribute.rowCount === 0) {
            return res.status(400).json("Invalid input"); 
        }

        //return a success status
        return res.status(204).send();
    } catch (err) {
        if (err.message.substr(0,46) === "duplicate key value violates unique constraint") {
            return res.status(409).json({ error: "This email or phone number is already being used by another user"});
        }
        return res.status(500).json({ error: "Server error" });
    }
});


router.put("/password", authorize, async (req, res) => {
    try {


        //capture entered attributes
        const { old_password, new_password } = req.body;

        //check if the required arguments have been provided
        if (!new_password || !old_password) {
            return res.status(400).json( { error: "Missing information"});
        }
        

        //get hashed password from DB
        let hashedPassword = await pool.query(
            "SELECT user_password FROM users WHERE user_id = $1",
            [req.user.id]
        );

        //check if password is captured
        if (hashedPassword.rows.length === 0) {
            return res.status(400).json({ error: "Invalid user" }); //shouldn't happen
        }

        hashedPassword = hashedPassword.rows[0].user_password;


        //check if the provided old password is the same as the actual old password
        const isValidPassword = await bcrypt.compare(
            old_password,
            hashedPassword
        );
      
        if (!isValidPassword) {
            return res.status(401).json({ error: "Wrong password" });
        }


        //check if the new password contains at least 6 and at most 32 characters
        if (new_password.length < 6) {
            return res.status(400).json({ error: "Password must consist of at least 6 characters"});
        }

        if (new_password.length > 32) {
            return res.status(400).json({ error: "Password must consist of at most 32 characters"});
        }

        //hash the new password
        const salt = await bcrypt.genSalt(10);
        const bcryptPassword = await bcrypt.hash(new_password, salt);


        //update password

        let user = await pool.query(
            "UPDATE users SET user_password = $1 WHERE user_id = $2 RETURNING *",
            [bcryptPassword, req.user.id]
        );


        //check if user was updated
        if (user.rows.length === 0) {
            return res.status(400).json("Unacceptable password"); //this case should not happen
        }

        //return a success status

        return res.status(204).send();
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
});


module.exports = router;