const nodemailer = require('nodemailer');
require("dotenv").config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.PASSWORD
    }
});

function emailSender(userEmail, emailSubject, emailText) {

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

module.exports = emailSender;

