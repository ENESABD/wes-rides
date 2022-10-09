const emailSender = require('./emailSender');



function notificationSender(userEmail, type) {

    const domain = 'http://localhost:8000';
    let emailText;
    let emailSubject;

    if (type === "someoneIsInterested") {
        emailSubject = "WesRides | Someone is interested in your ride"
        emailText = `
        Hello,

        It looks like someone is interested in one of your ride posts. 
        Log in to your account and head over to My Rides page to see more and take action.

        Thank you for using WesRides,
        WesRides Team
        `
    }

    if (type === "requestRejected") {
        emailSubject = "WesRides | There is an update to the status of your request to join someone's ride"
        emailText = `
        Hello,

        Unfortunately, the person in whose ride you showed interest has rejected your request to join their ride. 
        This could be due to multiple reasons: perhaps, they found someone else to share a ride with, or maybe, 
        they changed their plans and canceled their ride.

        Thank you for using WesRides,
        WesRides Team
        `
    }

    if (type === "requestAccepted") {
        emailSubject = "WesRides | There is an update to the status of your request to join someone's ride"
        emailText = `
        Hello,

        The person in whose ride you have shown interest has accepted your request to join their ride. Nice!

        Thank you for using WesRides,
        WesRides Team
        `
    }

    

    emailSender(userEmail, emailSubject, emailText)
    
}

module.exports = notificationSender;

