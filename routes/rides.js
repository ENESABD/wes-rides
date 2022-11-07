const router = require("express").Router();

const pool = require("../db");

const authorize = require("../middleware/authorize");
const validRideInfo = require("../middleware/validRideInfo");



router.get("/", authorize, async (req, res) => {
    try {

        //capture the values
        const {has_car, wants_car, wants_uber, search_word} = req.query;


        //check if search_word is valid
        if (search_word !== "" && (!search_word || typeof(search_word) !== "string")) {
            return res.status(400).json({ error: "Invalid search word" });
        }


        //check if only boolean values are passed for the filters
        if ((has_car !== 'true' && has_car !== 'false') || 
            (wants_car !== 'true' && wants_car !== 'false') || 
            (wants_uber !== 'true' && wants_uber !== 'false')) {
            return res.status(400).json({ error: "A boolean value must be passed for each parameter" });
        }
        

        //send queries to database
        let rides = null;
        let selectStatement = "SELECT ride_id, location, start_date, end_date FROM rides WHERE ";
        let userCheck =  " AND (user_id <> $3) AND ";
        let searchPattern = '%' + search_word.trim() + '%';
        let likeStatement = `((location ILIKE $4) OR (additional_comments ILIKE $4))`;
        let orderStatement = " ORDER BY (CASE WHEN location ILIKE $4 THEN 0 ELSE 1 END)ASC";

        let head = selectStatement;
        let tail = userCheck + likeStatement + orderStatement;

        if (has_car === 'true' || wants_car === 'true' || wants_uber === 'true') {
            if (has_car === 'true' || wants_car === 'true') {
                if (wants_uber === 'true') {
                    if (has_car === 'true' && wants_car === 'true') {
                        //all filters are true
                        rides = await pool.query(
                            head + "(status = $1 OR status = $2)" + tail,
                            ["pending", "awaiting_confirmation", req.user.id, searchPattern]
                        );
                    } else if (has_car === 'true') {
                        //only has_car and wants_uber are true
                        rides = await pool.query(
                            head + "(wants_uber = true OR has_car = true) AND (status = $1 OR status = $2)" + tail,
                            ["pending", "awaiting_confirmation", req.user.id, searchPattern]
                        );
                    } else {
                        //only wants_car and wants_uber are true
                        rides = await pool.query(
                            head + "(wants_car = true OR wants_uber = true) AND (status = $1 OR status = $2)" + tail,
                            ["pending", "awaiting_confirmation", req.user.id, searchPattern]
                        );
                    }
                } else {
                    if (has_car === 'true' && wants_car === 'true') {
                        //only has_car and wants_car are true
                        rides = await pool.query(
                            head + "(wants_car = true OR has_car = true) AND (status = $1 OR status = $2)" + tail,
                            ["pending", "awaiting_confirmation", req.user.id, searchPattern]
                        );
                    } else if (has_car === 'true') {
                        //only has_car is true
                        rides = await pool.query(
                            head + "(has_car = true) AND (status = $1 OR status = $2)" + tail,
                            ["pending", "awaiting_confirmation", req.user.id, searchPattern]
                        );
                    } else {
                        //only wants_car is true
                        rides = await pool.query(
                            head + "(wants_car = true) AND (status = $1 OR status = $2)" + tail,
                            ["pending", "awaiting_confirmation", req.user.id, searchPattern]
                        );
                    }
                }
            } else {
                //only wants_uber is true
                rides = await pool.query(
                    head + "(wants_uber = true) AND (status = $1 OR status = $2)" + tail,
                    ["pending", "awaiting_confirmation", req.user.id, searchPattern]
                );
            }
        } 


        //all filters are false
        if (!rides) {
            return res.status(404).json({ error: "Please select at least one filter" });
        }

        
        //check if there were any results for the filters
        if (rides.rows.length === 0) {
            return res.status(404).json({ error: "No rides satisfying the query" });
        }


        return res.status(200).json({ rides: rides.rows });

    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ error: "Server error" });
    }
});



router.get("/user", authorize, async (req, res) => {
    try {  

        //get the desired attributes of current user's rides
        const rides = await pool.query(
            "SELECT ride_id, status, location, start_date, end_date FROM rides WHERE user_id = $1 ORDER BY start_date DESC",
            [req.user.id]
        );

  
        //check if any ride was returned
        if (rides.rows.length === 0) {
            return res.status(404).json({ error: "No rides that belong to the user"});
        }


        //return the rides list
        return res.status(200).json({ rides: rides.rows });

    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ error: "Server error" });
    }
});



router.get("/:id", authorize, async (req, res) => {
    try {
        
        //capture ride ID
        const { id } = req.params;


        //prepare DB queries
        let ride;
        let parameters = "location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments";


        //if current user is the ride owner, we get the parameters listed above and the status
        ride = await pool.query(
            "SELECT status, " + parameters + " FROM rides WHERE ride_id = $1 AND user_id = $2",
            [id, req.user.id]
        );


        //check if a ride was returned, which would mean the ride does belong to the current user
        if (ride.rows.length === 1) {

            //capture ride
            ride = ride.rows[0];


            //get ride interests for this ride
            //also, include the related user's name
            let ride_interests = await pool.query(
                "SELECT ride_interest_id, status, user_name" + 
                    " FROM ride_interests INNER JOIN users ON ride_interests.user_id = users.user_id" + 
                    " WHERE ride_id = $1 ORDER BY status ASC",
                [id]
            );
    
            ride_interests = ride_interests.rows;


            //add associated ride interests to the object to be returned
            ride.associated_ride_interests = ride_interests;
            ride.request_made_by_owner = true;

            //return ride details object
            return res.status(200).json(ride);

        }

        //since the ride does not belong to the current user, 
        //we will only return ride details if the user has an accepted interest in the ride or
        //if the ride is pending or awaiting

        //get ride details with ride owner's info for rides that are pending and awaiting_confirmation
        ride = await pool.query(
            "SELECT " + parameters + 
                ", user_name, user_email, user_phone_number, user_instagram, user_facebook, user_snapchat " +
                "FROM rides INNER JOIN users ON rides.user_id = users.user_id " +
                "WHERE ride_id = $1 AND (status = $2 OR status = $3)",
            [id, "pending", "awaiting_confirmation"]
        );


        //check if a ride was returned and get ride interest info accordingly
        let ride_interest;

        if (ride.rows.length === 0) {

            //since the ride is not pending or awaiting_confirmation, we check if the current user has an accepted interest
            ride_interest = await pool.query(
                "SELECT ride_interest_id, status FROM ride_interests WHERE ride_id = $1 and user_id = $2 and status = $3",
                [id, req.user.id, "accepted"]
            );


            //if the current user has an accepted interest in this ride, share ride details
            //otherwise, return an informative message
            if (ride_interest.rows.length === 0) {
                return res.status(400).json({ error: "No available ride with this ride ID" });
            }


            //get ride details with ride owner's info
            ride = await pool.query(
                "SELECT " + parameters + 
                    " user_name, user_email, user_phone_number, user_instagram, user_facebook, user_snapchat " +
                    "FROM rides INNER JOIN users ON rides.user_id = users.user_id " +
                    "WHERE ride_id = $1",
                [id]
            );

        } else {
            
            //since the ride is pending or awaiting confirmation, we share ride details regardless of ride_interest status
            ride_interest = await pool.query(
                "SELECT ride_interest_id, status FROM ride_interests WHERE ride_id = $1 and user_id = $2",
                [id, req.user.id]
            );

        }


        //add to the ride object ride interest by the current user in this ride if it exists
        ride = ride.rows[0];
        ride_interest = ride_interest.rows[0] || {ride_interest_id: null, status: null};
        ride.ride_interest_id = ride_interest.ride_interest_id;
        ride.ride_interest_status = ride_interest.status;
        ride.request_made_by_owner = false;


        //return the ride details
        return res.status(200).json(ride);
        
    } catch (err) {
        console.log(err.message);
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" });
        }
        return res.status(500).json({ error: "Server error" });
    }
});



router.post("/", [authorize, validRideInfo], async (req, res) => {
    try {

        //capture input
        const { location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments } = req.body;

        
        //check if the ride is a duplicate
        let ride;
        ride = await pool.query(
            "SELECT * FROM rides WHERE user_id = $1 AND location = $2 AND start_date = $3",
            [req.user.id, location, start_date]
        );

        if (ride.rows.length !== 0) {
            return res.status(400).json({ error: "You have already posted this ride. You can edit it." });
        }


        //create a ride with the current user's ID
        //if additional comments are provided, include them as well
        ride = await pool.query(
            "INSERT INTO rides (user_id, location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments)" 
                + " VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
            [req.user.id, location.trim(), start_date, 
                end_date, has_car, wants_car, wants_uber, 
                (additional_comments ? additional_comments.trim() : null)]
        );

        
        //check if a ride was created
        if (ride.rows.length === 0) {
            return res.status(400).json({ error: "Missing or invalid information" });
        }

    
        //return ride ID
        return res.status(200).json({ ride_id: ride.rows[0].ride_id});

    } catch (err) {
        console.log(err.message);
        if (err.message.substr(0, 34) === "date/time field value out of range") {
            return res.status(400).json({ error: "Invalid timestamp" })
        }
        if (err.message.substr(0, 39) === "invalid input syntax for type timestamp") {
            return res.status(400).json({ error: "Invalid timestamp" })
        }
        return res.status(500).json({ error: "Server error" });
    }
});



router.put("/:id", [authorize, validRideInfo], async (req, res) => {
    try {

        //capture ID and input 
        const { id } = req.params;
        const { location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments } = req.body;


        //get ride information
        const current_ride = await pool.query(
            "SELECT * FROM rides WHERE user_id = $1 AND ride_id = $2",
            [req.user.id, id]
        );

        const { location: old_location, start_date: old_start_date, status,
                has_car: old_has_car, wants_car: old_wants_car, wants_uber: old_wants_uber} = current_ride.rows[0];


        //check if it is allowed to edit this ride
        if (status !== "pending" && status !== "awaiting_confirmation") {
            return res.status(400).json({ error: "This ride cannot be edited anymore" });
        }

        
        //check if updating will make all filters false
        let filter_list = [
            typeof(has_car) !== "undefined" ? has_car : old_has_car,
            typeof(wants_car) !== "undefined" ? wants_car : old_wants_car,
            typeof(wants_uber) !== "undefined" ? wants_uber : old_wants_uber,
        ]

        if (filter_list.every(element => element === false)) {
            return res.status(400).json({ error: "These changes would make all filters false" });
        }
        
        //check if updating will make this a duplicate ride
        const possible_duplicate = await pool.query(
            "SELECT * FROM rides WHERE user_id = $1 AND location = $2 AND start_date = $3",
            [req.user.id, 
                (location ? location : old_location), 
                (start_date ? start_date : old_start_date)]
        );

        if (possible_duplicate.rows.length !== 0 && possible_duplicate.rows[0].ride_id != id) {
            return res.status(400).json({ error: "These changes would make this ride a duplicate of another ride by this user" });
        }


        //check which arguments have been entered, and update them
        let ride;
        let head = "UPDATE rides SET ";
        let tail = " WHERE ride_id = $2 AND user_id = $3 RETURNING *";

        if (location) {
            ride = await pool.query(
                head + "location = $1" + tail,
                [location.trim(), id, req.user.id]
            );
        }

        if (start_date) {
            ride = await pool.query(
                head + "start_date = $1" + tail,
                [start_date, id, req.user.id]
            );
        }

        if (end_date) {
            ride = await pool.query(
                head + "end_date = $1" + tail,
                [end_date, id, req.user.id]
            );
        }

        if (typeof(has_car) !== "undefined") {
            ride = await pool.query(
                head + "has_car = $1" + tail,
                [has_car, id, req.user.id]
            );
        }

        if (typeof(wants_car) !== "undefined") {
            ride = await pool.query(
                head + "wants_car = $1" + tail,
                [wants_car, id, req.user.id]
            );
        }

        if (typeof(wants_uber) !== "undefined") {
            ride = await pool.query(
                head + "wants_uber = $1" + tail,
                [wants_uber, id, req.user.id]
            );
        }

        if (additional_comments || additional_comments === null || additional_comments === "") {
            ride = await pool.query(
                head + "additional_comments = $1" + tail,
                [additional_comments.trim(), id, req.user.id]
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
        return res.status(200).json({ success: true });

    } catch (err) {
        console.log(err.message);
        
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" })
        }

        if (err.message.substr(0, 27) === "Cannot destructure property") {
            return res.status(400).json({ error: "User is not authorized to edit this ride or invalid ride ID" })
        }

        if (err.message.substr(0, 39) === "invalid input syntax for type timestamp") {
            return res.status(400).json({ error: "Invalid timestamp" })
        }

        return res.status(500).json({ error: "Server error" });
    }
});



router.delete("/:id", authorize, async (req, res) => {
    try {

        //capture ID
        const { id } = req.params;


        //check if the ride belongs to the current user and the status is not confirmed or completed
        const ride = await pool.query(
            "SELECT * FROM rides WHERE ride_id = $1 AND user_id = $2 AND (status <> $3 AND status <> $4)",
            [id, req.user.id, "confirmed", "completed"]
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
    
        //send a success status
        return res.status(200).json({ success: true });

    } catch (err) {
        console.log(err.message);
        if (err.message.substr(0, 37) === "invalid input syntax for type integer") {
            return res.status(400).json({ error: "Invalid ride ID" })
        }
        return res.status(500).json({ error: "Server error" });
    }
});


module.exports = router;