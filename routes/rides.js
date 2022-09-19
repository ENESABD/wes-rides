const router = require("express").Router();
const authorize = require("../middleware/authorize");
const validRideInfo = require("../middleware/validRideInfo");
const pool = require("../db");



router.get("/", authorize, async (req, res) => {
    try {
        const {has_car, wants_car, wants_uber} = req.query;

        //check if only boolean values are passed
        if ((has_car !== 'true' && has_car !== 'false') || 
            (wants_car !== 'true' && wants_car !== 'false') || 
            (wants_uber !== 'true' && wants_uber !== 'false')) {
            return res.status(400).json({ error: "A boolean value must be passed for each parameter" });
        }

        let rides = null;

        if (has_car === 'true' || wants_car === 'true' || wants_uber === 'true') {
            if (has_car === 'true' || wants_car === 'true') {
                if (wants_uber === 'true') {
                    if (has_car === 'true' && wants_car === 'true') {
                        //all filters are true
                        rides = await pool.query(
                            "SELECT ride_id, location, start_date, end_date, has_car, wants_car, wants_uber FROM rides WHERE status = $1 OR status = $2",
                            ["pending", "awaiting_confirmation"]
                        );
                    } else if (has_car === 'true') {
                        //only has_car and wants_uber are true
                        rides = await pool.query(
                            "SELECT ride_id, location, start_date, end_date, has_car, wants_car, wants_uber FROM rides WHERE (wants_uber = true OR has_car = true) AND (status = $1 OR status = $2)",
                            ["pending", "awaiting_confirmation"]
                        );
                    } else {
                        //only wants_car and wants_uber are true
                        rides = await pool.query(
                            "SELECT ride_id, location, start_date, end_date, has_car, wants_car, wants_uber FROM rides WHERE (wants_car = true OR wants_uber = true) AND (status = $1 OR status = $2)",
                            ["pending", "awaiting_confirmation"]
                        );
                    }
                } else {
                    if (has_car === 'true' && wants_car === 'true') {
                        //only has_car and wants_car are true
                        rides = await pool.query(
                            "SELECT ride_id, location, start_date, end_date, has_car, wants_car, wants_uber FROM rides WHERE (wants_car = true OR has_car = true) AND (status = $1 OR status = $2)",
                            ["pending", "awaiting_confirmation"]
                        );
                    } else if (has_car === 'true') {
                        //only has_car is true
                        rides = await pool.query(
                            "SELECT ride_id, location, start_date, end_date, has_car, wants_car, wants_uber FROM rides WHERE (has_car = true) AND (status = $1 OR status = $2)",
                            ["pending", "awaiting_confirmation"]
                        );
                    } else {
                        //only wants_car is true
                        rides = await pool.query(
                            "SELECT ride_id, location, start_date, end_date, has_car, wants_car, wants_uber FROM rides WHERE (wants_car = true) AND (status = $1 OR status = $2)",
                            ["pending", "awaiting_confirmation"]
                        );
                    }
                }
            } else {
                //only wants_uber is true
                rides = await pool.query(
                    "SELECT ride_id, location, start_date, end_date, has_car, wants_car, wants_uber FROM rides WHERE (wants_uber = true) AND (status = $1 OR status = $2)",
                    ["pending", "awaiting_confirmation"]
                );
            }
        } 

        //all filters are false
        if (!rides) {
            return res.status(200).json({ rides: [] });
        }

        //check if there were any results for the filters
        if (rides.rows.length === 0) {
            return res.status(404).json({ error: "No rides satisfying the filters" });
        }


        return res.status(200).json({ rides: rides.rows });
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
});

router.get("/user", authorize, async (req, res) => {
    try {  

        //get the desired attributes of current user's rides
        const rides = await pool.query(
            "SELECT ride_id, status, location, start_date, end_date FROM rides WHERE user_id = $1",
            [req.user.id]
        );
  
        //check if any ride was returned
        if (rides.rows.length === 0) {
            return res.status(404).json({ error: "No rides that belong to the user"});
        }

        //return the rides list
        return res.status(200).json({ rides: rides.rows });
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
});


router.get("/:id", authorize, async (req, res) => {
    try {
        const { id } = req.params;


        let ride = null;

        //check if the ride belongs to current user
        //if so, we get status but not user ID
        ride = await pool.query(
            "SELECT status, location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments FROM rides WHERE ride_id = $1 AND user_id = $2",
            [id, req.user.id]
        );

        //return the ride, which must be current user's
        if (ride.rows.length === 1) {
            return res.status(200).json({ ride: ride.rows[0]})
        }

        //if the ride does not belong to current user,
        //we get user ID but not status,
        //and only return the ride if status is pending or awaiting_confirmation
        ride = await pool.query(
            "SELECT user_id, location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments FROM rides WHERE ride_id = $1 AND (status = $2 OR status = $3)",
            [id, "pending", "awaiting_confirmation"]
        );
        
        //check if a ride was returned
        if (ride.rows.length === 0) {
            return res.status(404).json({ error: "No ride to be displayed" });
        }

        //return the ride, which must be not current user's
        return res.status(200).json({ ride: ride.rows[0]});
    } catch (err) {
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" })
        }
        return res.status(500).json({ error: "Server error" });
    }
});


router.post("/", [authorize, validRideInfo], async (req, res) => {
    try {
        const { location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments } = req.body;

        let ride;
        //check if the ride is a duplicate
        ride = await pool.query(
            "SELECT * FROM rides WHERE user_id = $1 AND location = $2 AND start_date = $3 AND (status = $4 OR status = $5)",
            [req.user.id, location, start_date,
                "pending", "awaiting_confirmation"]
        );

        if (ride.rows.length !== 0) {
            return res.status(400).json({ error: "You have already posted this ride. You can edit it." });
        }

        //create a ride with the current user's ID
        //if additional comments are provided, include them as well
        ride = await pool.query(
            "INSERT INTO rides (user_id, location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
            [req.user.id, location, start_date, 
                end_date, has_car, wants_car, wants_uber, 
                (additional_comments ? additional_comments : null)]
        );

        
    
        //check if a ride was created
        if (ride.rows.length === 0) {
            return res.status(400).json({ error: "Missing or invalid information" });
        }
    
        //return a success status
        return res.status(201).send();
    } catch (err) {
        if (err.message.substr(0, 39) === "invalid input syntax for type timestamp") {
            return res.status(400).json({ error: "Invalid timestamp" })
        }
        return res.status(500).json({ error: "Server error" });
    }
});

router.put("/:id", [authorize, validRideInfo], async (req, res) => {
    try {
        const { id } = req.params;
        const { location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments } = req.body;

        
        const current_ride = await pool.query(
            "SELECT * FROM rides WHERE user_id = $1 AND ride_id = $2",
            [req.user.id, id]
        );

        const { location: old_location, start_date: old_start_date, 
                status } = current_ride.rows[0];

        //check if it is allowed to edit this ride
        if (status !== "pending" && status !== "awaiting_confirmation") {
            return res.status(400).json({ error: "This ride cannot be edited anymore" });
        }
        
        //check if updating will make this a duplicate ride
        const possible_duplicate = await pool.query(
            "SELECT * FROM rides WHERE user_id = $1 AND location = $2 AND start_date = $3 AND (status = $4 OR status = $5)",
            [req.user.id, 
                (location ? location : old_location), 
                (start_date ? start_date : old_start_date),
                "pending", "awaiting_confirmation"]
        );


        if (possible_duplicate.rows.length !== 0 && possible_duplicate.rows[0].ride_id != id) {
            return res.status(400).json({ error: "These changes would make this ride a duplicate of another ride by this user" });
        }

        //check which arguments have been entered, and update them

        let ride;

        if (location) {
            ride = await pool.query(
                "UPDATE rides SET location = $1 WHERE ride_id = $2 AND user_id = $3 RETURNING *",
                [location, id, req.user.id]
            );
        }

        if (start_date) {
            ride = await pool.query(
                "UPDATE rides SET start_date = $1 WHERE ride_id = $2 AND user_id = $3 RETURNING *",
                [start_date, id, req.user.id]
            );
        }

        if (end_date) {
            ride = await pool.query(
                "UPDATE rides SET end_date = $1 WHERE ride_id = $2 AND user_id = $3 RETURNING *",
                [end_date, id, req.user.id]
            );
        }

        if (typeof(has_car) !== "undefined") {
            ride = await pool.query(
                "UPDATE rides SET has_car = $1 WHERE ride_id = $2 AND user_id = $3 RETURNING *",
                [has_car, id, req.user.id]
            );
        }

        if (typeof(wants_car) !== "undefined") {
            ride = await pool.query(
                "UPDATE rides SET wants_car = $1 WHERE ride_id = $2 AND user_id = $3 RETURNING *",
                [wants_car, id, req.user.id]
            );
        }

        if (typeof(wants_uber) !== "undefined") {
            ride = await pool.query(
                "UPDATE rides SET wants_uber = $1 WHERE ride_id = $2 AND user_id = $3 RETURNING *",
                [wants_uber, id, req.user.id]
            );
        }

        if (additional_comments || additional_comments === null) {
            ride = await pool.query(
                "UPDATE rides SET additional_comments = $1 WHERE ride_id = $2 AND user_id = $3 RETURNING *",
                [additional_comments, id, req.user.id]
            );
        }

        //check if an argument was passed
        if (!ride) {
            return res.status(400).json({ error: "Missing information" });
        }

        //check if an update was made
        if (ride.rows.length === 0) {
            return res.status(400).json({ error: "User is not authorized to edit this ride or invalid ride ID" });
        }

        //return a success status
        return res.status(204).send();
    } catch (err) {
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" })
        }

        if (err.message.substr(0, 27) === "Cannot destructure property") {
            return res.status(400).json({ error: "User is not authorized to edit this ride or invalid ride ID" })
        }

        if (err.message.substr(0, 39) === "invalid input syntax for type timestamp") {
            return res.status(400).json({ error: "Invalid timestamp" })
        }

        console.log(err.message);
        return res.status(500).json({ error: "Server error" });
    }
});




router.delete("/:id", authorize, async (req, res) => {
    try {
        const { id } = req.params;

        //check if the ride belongs to the current user
        const ride = await pool.query(
            "SELECT * FROM rides WHERE ride_id = $1 AND user_id = $2",
            [id, req.user.id]
        );

        if (ride.rows.length === 0) {
            return res.status(404).json({ error: "No rides with this ID that the user can delete" });
        }

        //delete related ride interests
        await pool.query(
            "DELETE FROM ride_interests WHERE ride_id = $1",
            [id]
        );

        //delete the ride
        await pool.query(
            "DELETE FROM rides WHERE ride_id = $1",
            [id]
        );
    
        return res.status(204).send();
    } catch (err) {
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" })
        }
        return res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;


/* 

router.put("/status/:id", [authorize, validRideInfo], async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;


        //check if the provided argument is either of the three valid options
        if (status !== "awaiting_confirmation" && status !== "confirmed" && status !== "pending") {
            return res.status(400).json({ error: "Missing or invalid information" });
        }


        let ride;

        //check if the ride with the provided ID exists
        //and if so, make sure that it is not confirmed, completed or failed
        ride = await pool.query(
            "SELECT * FROM rides WHERE ride_id = $1 AND (status = $2 OR status = $3)",
            [id, "pending", "awaiting_confirmation"]
        );

        if (ride.rows.length === 0) {
            return res.status(400).json({ error: "Invalid ride ID or status cannot be changed" });
        }


        if (status === "awaiting_confirmation") {
            //the requester is trying to indicate that 
            //there is at least one ride interest for the ride with the given ID
            //so, we check if the current user has posted a ride interest for this ride
            //if so, we update the status accordingly, if it is not already "awaiting_confirmation"

            let ride_interest = await pool.query(
                "SELECT * FROM ride_interests WHERE user_id = $1 AND ride_id = $2 RETURNING *",
                [req.user.id, id]
            );

            if (ride_interest.rows.length !== 0) {
                if (ride.rows[0].status === "pending") {
                    ride = await pool.query(
                        "UPDATE rides SET status = $1 WHERE ride_id = $2",
                        ["awaiting_confirmation", id]
                    );

                    //return success status
                    return res.status(204).send();
                } else {
                    //return success status
                    return res.status(204).send();
                }
            } else {
                return res.status(403).json({ error: "This status is only applicable when there is a ride interest for the ride" });
            }

        } else {
            //the requester is trying to confirm a ride interest
            //so, we check if the current user is the poster of the ride with the given ID
            //if so, we update the status of the ride 
            if (ride.rows[0].user_id !== req.user.id) {
                return res.status(403).json({ error: "Only the poster of the ride can accept the ride interest" });
            } else {
                ride = await pool.query(
                    "UPDATE rides SET status = $1 WHERE ride_id = $2 RETURNING *",
                    ["confirmed", id]
                );

            //return success status
            return res.status(204).send();
            }
        } 

    } catch (err) {
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" })
        }
        return res.status(500).json({ error: "Server error" });
    }
});



*/