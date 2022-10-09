const emailSender = require('./emailSender');



function tokenSender(userEmail, token, isPasswordChange) {

    const domain = 'http://localhost:8000';
    let emailText;
    let emailSubject;

    if (isPasswordChange) {
        emailSubject = 'WesRides | Password Change Request'
        emailText = `Hi, We received your request to change your password. 
                Please click on this link: https://google.com/password-reset/${token} .
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

