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
        if (location && (!(/^[\.a-zA-Z0-9, ]*$/.test(location)) || typeof(location) !== "string" || location.length > 50)) {
            return res.status(400).json({ error: "Location can only contain letters, numbers, spaces, or commas, \
                                                       must be a string and must be limited to 50 characters" });
        }

        //check if additional_comments is valid, if provided
        if (additional_comments && (typeof(additional_comments) !== "string" || additional_comments.length > 1500)) {
            return res.status(400).json({ error: "Additional comments must be in string format and be limited to 1500 characters" });
        }


        //check if dates are in the desired format (mm-dd-yy)
        if (start_date &&
            ((start_date[2] !== '-' || start_date[5] !== '-') ||
            (start_date[0] === '1' && (start_date[1] !== '0' && start_date[1] !== '1' && start_date[1] !== '2')) ||
            (!((/^\d+$/.test(start_date[1])) && (/^\d+$/.test(start_date[4]))))  ||
            (start_date.substring(6,8) !== '22' && start_date.substring(6,8) !== '23')  ||
            (start_date[0] === '0' && start_date[1] === '0')  ||
            (start_date[3] === '0' && start_date[4] === '0')  ||
            (start_date[3] !== '0' && start_date[3] !== '1' && start_date[3] !== '2' && start_date[3] !== '3'))) {

                return res.status(400).json({ error: "Start date must be in mm-dd-yy format" });
            }
        
        if ((end_date && (start_date !== end_date)) &&
            ((end_date[2] !== '-' || end_date[5] !== '-') ||
            (end_date[0] === '1' && (end_date[1] !== '0' && end_date[1] !== '1' && end_date[1] !== '2')) ||
            (!((/^\d+$/.test(end_date[1])) && (/^\d+$/.test(end_date[4]))))  ||
            (end_date.substring(6,8) !== '22' && end_date.substring(6,8) !== '23')  ||
            (end_date[0] === '0' && end_date[1] === '0')  ||
            (end_date[3] === '0' && end_date[4] === '0')  ||
            (end_date[3] !== '0' && end_date[3] !== '1' && end_date[3] !== '2' && end_date[3] !== '3'))) {

                return res.status(400).json({ error: "End date must be in mm-dd-yy format" });
            }
        
        
        //check if dates are in the future
        let now = new Date();
        now.setHours(0,0,0,0);
        if (start_date && (new Date(start_date) < now)) {
            return res.status(400).json({ error: "Start date cannot be earlier than now" });
        } 

        if ((end_date && (start_date !== end_date)) && ((new Date(end_date) < now))) {
            return res.status(400).json({ error: "End date cannot be earlier than now" });
        } 

        //check if start date is earlier than end date
        if ((end_date && (start_date !== end_date)) && ((new Date(end_date) < new Date(start_date)))) {
            return res.status(400).json({ error: "End date cannot be earlier than start date" });
        } 

        next();
    } catch (err) {
        console.log(err.message);
        return res.status(400).json({ error: "Server error" });
    }
}