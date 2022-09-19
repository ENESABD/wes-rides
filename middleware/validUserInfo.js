module.exports = function(req, res, next) {
  const { email, name, password, phone } = req.body;

  //for login and register password and email are required
  if (req.path === "/login" || req.path === "/register") {
    if (![email, password].every(Boolean)) {
      return res.status(400).json({ error: "Missing credentials"});
    }
  }

  //for register only, name is required
  if (req.path === "/register") {
    if (!name) {
      return res.status(400).json({ error: "Missing information"});
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must consist of at least 6 characters"});
    }

    if (password.length > 32) {
      return res.status(400).json({ error: "Password must consist of at most 32 characters"});
    }
  }


  //for register and user, name and phone must be validated
  //for user none is required
  if (req.path === "/register" || req.baseUrl === "/user") {
    //check if name is proper
    if (name) {
      if (!(/^([a-zA-Z]+\s)*[a-zA-Z]+$/.test(name))) {
        return res.status(400).json({ error: "Name must start and end with a letter," 
          + "cannot contain a number, special characters, or consecutive spaces"});
      } else if (name.length > 25) {
        return res.status(400).json({ error: "Name cannot contain more than 24 characters"});
      }
    }

    //if phone number is entered, check if it is only numerical and has exactly 10 digits
    if (phone) {
      if (!(/^\d+$/.test(phone))) {
        return res.status(400).json({ error: "Phone number must contain only numbers"});
      } else if (phone.length !== 10){
        return res.status(400).json({ error: "Phone number must contain exactly 10 digits and must be in a string format"});
      }
    }

  }
  
  //check if email is a Wes email (for the /user route, email is optional)
  if (email) {
    if (!(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email))) {
      return res.status(400).json({ error: "Invalid email"});
    } 

    if (email.substr(-13) !== "@wesleyan.edu"){
      return res.status(400).json({ error: "Email must be a Wesleyan email"});
    }  
  }
  
  
  
  next();
};