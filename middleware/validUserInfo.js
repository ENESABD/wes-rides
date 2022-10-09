module.exports = function(req, res, next) {

  const { email, name, password, phone, snapchat, facebook, instagram } = req.body;


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


    //check if password length is between 6 and 32
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
      } else if (name.length > 24) {
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

  //check if the remaining values are too long
  if (snapchat && (snapchat.length > 50)) {
    return res.status(400).json({ error: "Snapchat value should contain less than 50 characters"});
  }  

  if (facebook && (facebook.length > 50)) {
    return res.status(400).json({ error: "Facebook value should contain less than 50 characters"});
  }  

  if (instagram && (instagram.length > 50)) {
    return res.status(400).json({ error: "Instagram value should contain less than 50 characters"});
  }  
  
  
  next();
};