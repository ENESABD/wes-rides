const router = require("express").Router();
const authorize = require("../middleware/authorize");
const pool = require("../db");
const notificationSender = require("../utils/notificationSender");


router.post("/", authorize, async (req, res) => {
    try {

        //capture ride ID
        const { ride_id } = req.body;


        //check if a ride interest from the user for this ride already exists
        const alreadyExistent = await pool.query(
            "SELECT * FROM ride_interests WHERE user_id = $1 AND ride_id = $2",
            [req.user.id, ride_id]
        );

        if (alreadyExistent.rows.length !== 0) {
            return res.status(409).json({ error: "A ride interest with this user ID and ride ID already exists" });
        }


        //check if the ride is available for adding a ride interest
        //(not available for states "confirmed", "completed", "failed")
        const ride = await pool.query(
            "SELECT user_id FROM rides WHERE ride_id = $1 AND (status = $2 OR status = $3)",
            [ride_id, "pending", "awaiting_confirmation"]
        );

        if (ride.rows.length === 0) {
            return res.status(404).json({ error: "No ride with this ID is available for a ride interest" });
        }


        //check if the user adding a ride interest is the same as the poster of the ride
        if (ride.rows[0].user_id === req.user.id) {
            return res.status(403).json({ error: "The user cannot add a ride interest to their own ride" });
        }


        //create the ride interest
        let new_ride_interest = await pool.query(
            "INSERT INTO ride_interests (user_id, ride_id) VALUES ($1, $2) RETURNING *",
            [req.user.id, ride_id]
        );


        //notify the ride owner
        let ride_owner = await pool.query(
            "SELECT user_email FROM users WHERE user_id = $1",
            [ride.rows[0].user_id]
        );

        ride_owner = ride_owner.rows[0].user_email;
        notificationSender(ride_owner, "someoneIsInterested");


        //update the status of the ride to awaiting_confirmation, if it is not already so
        await pool.query(
            "UPDATE rides SET status = $1 WHERE ride_id = $2",
            ["awaiting_confirmation", ride_id]
        );


        //return success code
        return res.status(200).json({ ride_interest_id: new_ride_interest.rows[0].ride_interest_id });

    } catch (err) {
        console.log(err.message);
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});



router.get("/:id", authorize, async (req, res) => {
    try {
        
        //capture the ID
        const { id } = req.params;


        //get ride_interest details if the current user is the owner of the related ride
        let ride_interest_details = await pool.query(
            "SELECT ride_interests.status, " + 
            "user_name, user_email, user_phone_number, user_snapchat, user_instagram, user_facebook, " +
            "rides.ride_id, location, start_date, end_date " + 
            "FROM ride_interests LEFT JOIN users ON ride_interests.user_id = users.user_id " +
            "LEFT JOIN rides ON ride_interests.ride_id = rides.ride_id " +
            "WHERE ride_interest_id = $1 AND rides.user_id = $2",
            [id, req.user.id]
        );


        //check if ride_interest details were returned
        if (ride_interest_details.rows.length === 0) {
            return res.status(400).json({ error: "No ride interest with this ID available for detailed view" });
        }


        //return ride interest details
        return res.status(200).json({ ride_interest_details: ride_interest_details.rows[0] });

    } catch (err) {
        console.error(err.message);
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride interest ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});



router.get("/", authorize, async (req, res) => {
    try {
        
        //get ride interests by the current user
        let ride_interests;

        ride_interests = await pool.query(
            "SELECT ride_interest_id, ride_interests.status, location, start_date, end_date FROM ride_interests " + 
            "LEFT JOIN rides ON ride_interests.ride_id = rides.ride_id " +
            "WHERE ride_interests.user_id = $1 ORDER BY ride_interests.status ASC",
            [req.user.id]
        );

        ride_interests = ride_interests.rows;


        //check if any ride_interest was returned
        if (ride_interests.length === 0) {
            return res.status(404).json({ error: "No ride interests from this user"});
        }


        //return ride_interests
        return res.status(200).json({ ride_interests : ride_interests });

    } catch (err) {
        console.log(err.message);
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});



router.put("/:id", authorize, async (req, res) => {
    try {

        //capture ID and input
        const { id } = req.params;
        const { status } = req.body;

        
        //check if status is either of the valid options
        if (status !== "accepted" && status !== "rejected") {
            return res.status(403).json({ error: "Status can only be changed to accepted or rejected"});
        }


        //check if ride interest exists
        const ride_interest = await pool.query(
            "SELECT * FROM ride_interests WHERE ride_interest_id = $1",
            [id]
        );

        if (ride_interest.rows.length === 0) {
            return res.status(404).json({ error: "Ride interest with this ID does not exist"});
        }


        //check if the related ride belongs to the current user
        const ride = await pool.query(
            "SELECT * FROM rides WHERE ride_id = $1 AND user_id = $2",
            [ride_interest.rows[0].ride_id, req.user.id]
        );

        if (ride.rows.length === 0) {
            return res.status(400).json({ error: "The related ride does not belong to the current user"});
        }

        
        //check if it is awaiting confirmation
        if (ride_interest.rows[0].status !== "awaiting_confirmation") {
            return res.status(400).json({ error: "This ride interest has already been accepted or rejected"});
        }

        //get ride interest owner's email
        let ride_interest_owner = await pool.query(
            "SELECT user_email FROM users WHERE user_id = $1",
            [ride_interest.rows[0].user_id]
        );

        ride_interest_owner = ride_interest_owner.rows[0].user_email;


        //handle the case where status is rejected
        if (status === "rejected") {
            //check if ride status should change from awaiting_confirmation to pending
            const other_ride_interests = await pool.query(
                "SELECT * FROM ride_interests WHERE ride_id = $1 AND status = $2",
                [ride_interest.rows[0].ride_id, "awaiting_confirmation"]
            );

            if (other_ride_interests.rows.length === 1) {
                await pool.query(
                    "UPDATE rides SET status = $1 WHERE ride_id = $2",
                    ["pending", ride_interest.rows[0].ride_id]
                );
            }


            //notify the ride interest owner that the request was rejected
            notificationSender(ride_interest_owner, "requestRejected");
        }


        //handle the case where status is accepted
        if (status === "accepted") {
            //set ride status to confirmed
            await pool.query(
                "UPDATE rides SET status = $1 WHERE ride_id = $2",
                ["confirmed", ride_interest.rows[0].ride_id]
            );


            //notify the rejected ones
            let rejectedOnes = await pool.query(
                "SELECT user_id FROM ride_interests WHERE status = $1 AND ride_id = $2 AND ride_interest_id <> $3",
                ["awaiting_confirmation", ride_interest.rows[0].ride_id, id]
            );
            
            let rejectedEmail;

            rejectedOnes.rows.forEach(async (rejectedOne) => {
                rejectedEmail = await pool.query(
                    "SELECT user_email FROM users WHERE user_id = $1",
                    [rejectedOne.user_id]
                );

                rejectedEmail = rejectedEmail.rows[0].user_email;
                notificationSender(rejectedEmail, "requestRejected");
            })
            

            //reject other ride interests
            await pool.query(
                "UPDATE ride_interests SET status = $1 WHERE ride_id = $2",
                ["rejected", ride_interest.rows[0].ride_id]
            );


            //notify the ride interest owner that the request was accepted
            notificationSender(ride_interest_owner, "requestAccepted");
        }


        //update 
        await pool.query(
            "UPDATE ride_interests SET status = $1 WHERE ride_interest_id = $2",
            [status, id]
        );
        

        //return a success status
        return res.status(201).send();

    } catch (err) {
        console.log(err.message);
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});



router.delete("/:id", authorize, async (req, res) => {
    try {

        //capture id
        const { id } = req.params;

        //check if ride interest exists
        const ride_interest = await pool.query(
            "SELECT * FROM ride_interests WHERE ride_interest_id = $1 AND user_id = $2",
            [id, req.user.id]
        );

        if (ride_interest.rows.length === 0) {
            return res.status(400).json({ error: "User is not authorized to delete this ride interest or no such ride interest" });
        }


        //check if status is accepted or rejected
        if (ride_interest.rows[0].status !== "awaiting_confirmation") {
            return res.status(404).json({ error: "This ride interest has been accepted or rejected and thus cannot be deleted"});
        }


        //delete
        await pool.query(
            "DELETE FROM ride_interests WHERE ride_interest_id = $1 AND user_id = $2",
            [id, req.user.id]
        );


        //check if ride status should change from awaiting_confirmation to pending
        const other_ride_interests = await pool.query(
            "SELECT * FROM ride_interests WHERE ride_id = $1",
            [ride_interest.rows[0].ride_id]
        );

        if (other_ride_interests.rows.length === 0) {
            await pool.query(
                "UPDATE rides SET status = $1 WHERE ride_id = $2",
                ["pending", ride_interest.rows[0].ride_id]
            );
        }

        
        //return success status
        return res.status(204).json();

    } catch (err) {
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});


module.exports = router;