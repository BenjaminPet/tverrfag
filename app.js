//jshint esversion:6

require("dotenv").config(); //dotenv får .env filen til å være skjult

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");

const MemoryStore = require('memorystore')(session)

const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
//google
const GoogleStrategy = require("passport-google-oauth20").Strategy;
//facebook
const FacebookStrategy = require('passport-facebook').Strategy;

// code får å få findorCreate som hjelper med å google/facebook fine om du har eller om de må lage en ny kont
const findOrCreate = require("mongoose-findorcreate")




const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs")
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    cookie: { maxAge: 86400000 },
    store: new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    }),
    secret: "Ourlittlsecret",
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());

//coden som linker databasen tverrDB til koden 
mongoose.connect("mongodb+srv://admin:1234@tverr.gisz5.mongodb.net/tverrDB", {
    useNewUrlParser: true
});

//
const userSchema = new mongoose.Schema({
    email: String, // email
    password: String,
    googleId: String, // dette er lagrer google IDen hvis du loger in med google
    facebookId: String, // dette er lagrer facebook IDen hvis du loger in med facebook
    secret: String
});

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

// får å finne den spesifikke collections som du vill sende/hente fra
const User = new mongoose.model("tverruser", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    })
});


//google strategy
passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://tverrfag.herokuapp.com/auth/google/tverrfag",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"

    },
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);

        User.findOrCreate({
            googleId: profile.id
        }, function (err, user) {
            return cb(err, user);
        });
    }
));


// facebook strategy
passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL: "https://tverrfag.herokuapp.com/auth/facebook/tverrfag",

    },
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);

        User.findOrCreate({
            facebookId: profile.id
        }, function (err, user) {
            return cb(err, user);
        });
    }
));

app.get("/", function (req, res) {
    res.render("home");
});


//auth google   dette sjekker om du du er tillat av google til bli athenticated
app.get("/auth/google",
    passport.authenticate("google", {
        scope: ["profile"]
    })
);

app.get("/auth/google/tverrfag",
    passport.authenticate("google", {
        failureRedirect: "/login"
    }),
    function (req, res) {
        res.redirect("/documentation")
    }
);


//auth facebook      dette sjekker om du du er tillat av facebook til bli athenticated
app.get("/auth/facebook",
    passport.authenticate("facebook", {
        scope: ["profile"]
    })
);

app.get("/auth/facebook/tverrfag",
    passport.authenticate("facebook", {
        failureRedirect: "/login"
    }),
    function (req, res) {
        res.redirect("/Documentation")
    }
);

// render login
app.get("/login", function (req, res) {
    res.render("login")
});

// render registrere
app.get("/register", function (req, res) {
    res.render("register")
});

// render documentasjon HVIS IsAthenticated = true(har funnet brukeren)
app.get("/documentation", function (req, res) {

    //  
    User.find({
        "secret": {
            $ne: null
        }
    }, function (err, foundUsers) {
        if (err) {
            console.log(err)
        } else {
            if (foundUsers) {
                res.render("documentation", {
                    usersWithSecrets: foundUsers
                })
            }
        }
    })
});

// ????????????????render submit HVIS IsAthenticated = true(har funnet brukeren)
app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit")
    } else {
        res.redirect("/login");
    }
})

// ?????????? hvis du er på submit og sender en beskjed så vill den dukke opp på documents
app.post("/submit", function (req, res) {
    const submittedSecrets = req.body.secret;

    console.log(req.user.id);

    User.findById(req.user.id, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            foundUser.secret = submittedSecrets;
            foundUser.save(function () {
                res.redirect("/documentation")
            })
        }
    })
})

//hvis logout knappen eller skriver in /logout så skal den logout og gå til homepage
app.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

// hvis du skriver en gyldig gmail og passord vil den lagre det ine på databasen
app.post("/register", function (req, res) {
    User.register({
        username: req.body.username
    }, req.body.password, function (err, user) {
        if (err) {
            console.log(err)
            res.redirect("/register")
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/")
            })
        }
    })
})

// hvis din email og passord stemmer med det på databasen vil den gi deg authentication og gå til document
app.post("/login", function (req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, function (err) {
        if (err) {
            console.log(err)
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/documentation")
            })
        }
    })

})

let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}

// starter opp serveren på nett
app.listen(port, function () {
    console.log("Express server listening on port %d in %s mode")
})