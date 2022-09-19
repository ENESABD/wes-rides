module.exports = function(req, res, next) {
    try {
        const { location, start_date, end_date, has_car, wants_car, wants_uber, additional_comments } = req.body;

        //check if the required arguments for the post request are provided
        if (req.method === "POST") {
            if ([location, start_date, end_date, has_car, wants_car, wants_uber].some((column) => typeof(column) === "undefined") || 
                    location.trim().length === 0) {
                return res.status(400).json({ error: "Missing information" });
            }
        }

        //check if all arguments are valid
        //(for put method, all are optional
        //  so, we only return errors if they are provided but not valid)


        //check if filters have boolean values
        if (typeof(has_car) !== "undefined" && typeof(has_car) !== "boolean") {
            return res.status(400).json({ error: "Filters must have boolean values" });
        }

        if (typeof(wants_uber) !== "undefined" && typeof(wants_uber) !== "boolean") {
            return res.status(400).json({ error: "Filters must have boolean values" });
        }

        if (typeof(wants_car) !== "undefined" && typeof(wants_car) !== "boolean") {
            return res.status(400).json({ error: "Filters must have boolean values" });
        }

        

        //check if location is valid
        if (location && (!(/^[\.a-zA-Z0-9, ]*$/.test(location)) || typeof(location) !== "string")) {
            return res.status(400).json({ error: "Location can only contain letters, numbers, spaces, or commas and must be a string" });
        }

        //check if additional_comments is valid, if provided
        if (additional_comments && typeof(additional_comments) !== "string") {
            return res.status(400).json({ error: "Additional comments must be in string format" });
        }


        //check if dates are in a timestamp format
        if (start_date && (new Date(start_date)).getTime() <= 0) {
            return res.status(400).json({ error: "Start and end dates must be in timestamp format" })
        } 

        if (end_date && (new Date(end_date)).getTime() <= 0) {
            return res.status(400).json({ error: "Start and end dates must be in timestamp format" })
        } 

        next();
    } catch (err) {
        return res.status(400).json({ error: "Server error" });
    }
};