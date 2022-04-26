//jshint esversion:6

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
//google
const GoogleStrategy = require("passport-google-oauth20").Strategy;
//facebook
const FacebookStrategy = require('passport-facebook').Strategy;

const findOrCreate = require("mongoose-findorcreate")



const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs")
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Ourlittlesecret",
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/tverrDB", {useNewUrlParser: true});

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    facebookId: String, 
    secret: String
});

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model("tverruser", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    })
});


//google strategy
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets", 
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"

  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


// facebook strategy
passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets", 

  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res) {
    res.render("home");
});


//auth google
app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/documentation", 
    passport.authenticate("google", { failureRedirect: "/login"}),
    function(req, res) {
        res.redirect("/documentation")
    }
);


//auth facebook
app.get("/auth/facebook",
    passport.authenticate("facebook", { scope: ["profile"] })
);

app.get("/auth/facebook/documentation", 
    passport.authenticate("facebook", { failureRedirect: "/login"}),
    function(req, res) {
        res.redirect("/Documentation")
    }
);


app.get("/login", function(req, res) {
    res.render("login")
});

app.get("/register", function(req, res) {
    res.render("register")
});

app.get("/documentation", function(req, res){
    User.find({"secret": {$ne: null}}, function(err, foundUsers) {
        if (err) {
            console.log(err)
        } else {
            if (foundUsers) {
                res.render("documentation", {usersWithSecrets: foundUsers})
            }
        }
    })
});

app.get("/submit", function(req, res) {
    if (req.isAuthenticated()) {
        res.render("submit")
    } else {
        res.redirect("/login");
    }
})

app.post("/submit", function(req, res) {
    const submittedSecrets = req.body.secret;

    console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            foundUser.secret = submittedSecrets;
            foundUser.save(function(){
                res.redirect("/documentation")
            })
        }
    })
})

app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
});

app.post("/register", function(req, res) {
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err) {
            console.log(err)
            res.redirect("/register")
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/")
            })
        }
    })
})   

app.post("/login", function(req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, function(err) {
        if (err) {
            console.log(err)
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/documentation")
            })
        }
    })

}) 




app.listen(3000, function() {
    console.log("Server started on port 3000")
})