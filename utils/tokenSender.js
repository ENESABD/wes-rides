const nodemailer = require('nodemailer');
require("dotenv").config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.PASSWORD
    }
});

const domain = 'http://localhost:8000';

function tokenSender(userEmail, token, isPasswordChange) {

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


    const mailConfigurations = {

        from: process.env.EMAIL_USERNAME,
    
        to: userEmail,
    
        subject: emailSubject,
        
        text: emailText
      
    };

    transporter.sendMail(mailConfigurations, function(error, info){
        if (error) {
            console.log(error);
        }
        console.log('Email Sent Successfully');
    });
    
}

module.exports = tokenSender;

