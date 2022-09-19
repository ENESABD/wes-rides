//imports

const express = require("express");
const app = express();

const cors = require("cors");

//middleware

app.use(cors());
app.use(express.json());

//routes

app.use("/authentication", require("./routes/authentication"));
app.use("/user", require("./routes/user"));
app.use("/rides", require("./routes/rides"));
app.use("/ride-interests", require("./routes/ride_interests"));
app.use('*', function (req, res) {
    res.status(404).json({ error: "No such route" });
})

//listen

app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is listening`);
});