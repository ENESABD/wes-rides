const router = require("express").Router();
const authorize = require("../middleware/authorize");
const pool = require("../db");


router.post("/", authorize, async (req, res) => {
    try {
        const { ride_id } = req.body;


        //check if a not-rejected ride interest from the user for this ride already exists
        const alreadyExistent = await pool.query(
            "SELECT * FROM ride_interests WHERE user_id = $1 AND ride_id = $2 AND (status = $3 OR status = $4)",
            [req.user.id, ride_id, "awaiting_confirmation", "accepted"]
        );

        if (alreadyExistent.rows.length !== 0) {
            return res.status(409).json({ error: "A pending or accepted ride interest with this user ID and ride ID already exists" });
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


        //check if the user adding a ride interest is the same as the poster of the user
        if (ride.rows[0].user_id === req.user.id) {
            return res.status(403).json({ error: "The user cannot add a ride interest to their own ride" });
        }

        //create the ride interest
        await pool.query(
            "INSERT INTO ride_interests (user_id, ride_id) VALUES ($1, $2) RETURNING *",
            [req.user.id, ride_id]
        );

        //update the status of the ride to awaiting_confirmation, if it is not already so
        await pool.query(
            "UPDATE rides SET status = $1 WHERE ride_id = $2",
            ["awaiting_confirmation", ride_id]
        );


        //return success code
        return res.status(201).send();
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
        const { id } = req.params;

        //check if ride_interest with given ID exists
        let ride_interest = await pool.query(
            "SELECT * from ride_interests WHERE ride_interest_id = $1",
            [id]
        );
 
        if (ride_interest.rows.length === 0) {
            return res.status(400).json({ error: "No ride interest with this ID" });
        }


        //check if the current user is the poster of the ride interest,
        //and if so, return ride_id, and status for the ride interest
        ride_interest = ride_interest.rows[0];

        if (ride_interest.user_id === req.user.id) {
            return res.status(200).json({ ride_id: ride_interest.ride_id, status: ride_interest.status });
        }

        //check if the current user is the poster of the related ride,
        //and if so, return the ID of the poster of the ride_interest, ride_id, and status for the ride_interest
        let ride = await pool.query(
            "SELECT * from rides WHERE ride_id = $1",
            [ride_interest.ride_id]
        );

        ride = ride.rows[0];

        if (ride.user_id === req.user.id) {
            return res.status(200).json({ user_id: ride_interest.user_id, ride_id: ride_interest.ride_id, status: ride_interest.status });
        }

        //return a forbidden status with a message
        return res.status(403).json({ error: "Only the poster of the ride interest or the related ride can view the details" });
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
        const { ride_id } = req.query;

        let ride_interests;

        if (!ride_id) {
            ride_interests = await pool.query(
                "SELECT * from ride_interests WHERE user_id = $1",
                [req.user.id]
            );

            ride_interests = ride_interests.rows;

            if (ride_interests.length === 0) {
                return res.status(404).json({ error: "No ride interests from this user"});
            }

            return res.status(200).json({ ride_interests : ride_interests });
        }


        const ride = await pool.query(
            "SELECT * FROM rides WHERE ride_id = $1 AND user_id = $2",
            [ride_id, req.user.id]
        );

        if (ride.rows.length === 0) {
            return res.status(404).json({ error: "No rides with this ID available to be viewed by the current user"});
        }

        ride_interests = await pool.query(
            "SELECT * from ride_interests WHERE ride_id = $1",
            [ride_id]
        );

        ride_interests = ride_interests.rows;

        if (ride_interests.length === 0) {
            return res.status(404).json({ error: "No ride interests for this ride"});
        }


        return res.status(200).json({ ride_interests : ride_interests });

    } catch (err) {
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});


router.put("/:id", authorize, async (req, res) => {
    try {
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


        //check if ride status should change from awaiting_confirmation to pending
        if (status === "rejected") {
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
        }
        
        //reject other ride interests
        if (status === "accepted") {
            await pool.query(
                "UPDATE rides SET status = $1 WHERE ride_id = $2",
                ["confirmed", ride_interest.rows[0].ride_id]
            );

            await pool.query(
                "UPDATE ride_interests SET status = $1 WHERE ride_id = $2",
                ["rejected", ride_interest.rows[0].ride_id]
            );
        }

        //update 
        await pool.query(
            "UPDATE ride_interests SET status = $1 WHERE ride_interest_id = $2",
            [status, id]
        );
        

        return res.status(201).send();
    } catch (err) {
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});


router.delete("/:id", authorize, async (req, res) => {
    try {
        const { id } = req.params;

        //check if ride interest exists
        const ride_interest = await pool.query(
            "SELECT * FROM ride_interests WHERE ride_interest_id = $1 AND user_id = $2",
            [id, req.user.id]
        );

        if (ride_interest.rows.length === 0) {
            return res.status(400).json({ error: "User is not authorized to delete this ride interest or no such ride interest" });
        }

        //check if status is accepted
        if (ride_interest.rows[0].status === "accepted") {
            return res.status(404).json({ error: "This ride interest has been accepted and cannot be deleted"});
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

    
        return res.status(204).json();
    } catch (err) {
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});





module.exports = router;