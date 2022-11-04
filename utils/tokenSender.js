const emailSender = require('./emailSender');
//require("dotenv").config();


function tokenSender(userEmail, token, isPasswordChange) {

    const domain = process.env.SERVER_HOST || 'http://192.168.0.3:8000';
    let emailText;
    let emailSubject;

    if (isPasswordChange) {
        emailSubject = 'WesRides | Password Change Request'
        emailText = `Hi, We received your request to change your password. 
                Please click on this link: ${process.env.CLIENT_HOST}/password-reset/${token} .
                Thanks!`;
    } else {
        emailSubject = 'WesRides | Email Verification'
        emailText = `Hi, Thank you for registering on WesRides. 
        
        To complete your registration, please click on this link: 
        
            ${domain}/user/email-verification/${token} .

        Thanks!`;
    }

    emailSender(userEmail, emailSubject, emailText)
    
}

module.exports = tokenSender;

