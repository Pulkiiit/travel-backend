const express = require("express");
const app = express();
const cors = require("cors");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
// const easyinvoice = require("easyinvoice");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const imageDownloader = require("image-downloader");
require("dotenv").config();
const User = require("./models/User");
const Place = require("./models/Place");
const Booking = require("./models/Booking");
const payment = require("./routes/payment");
const cookieParser = require("cookie-parser");
const { log } = require("console");
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret =
  "nG8D#%-FpF+AK7b5b|tgy}B:UMzL/%&Y5>)?1c=@O 4,R!L!(?e8Lfvv`MNO#4Fs";

const corsOptions = {
  origin: [
    "https://airbnb-clone-frontend-static.onrender.com",
    "https://pulkit-airbnb.netlify.app",
  ],
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};
// const corsOptions = {
//   origin: "http://localhost:5173",
//   methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
//   credentials: true,
//   optionsSuccessStatus: 204,
// };
app.use(cors(corsOptions));
// const invoiceGenerator = data => {
//   easyinvoice.createInvoice(data, function (result) {
//     fs.writeFileSync(
//       __dirname + "/invoice/invoice_" + Date.now() + ".pdf",
//       result.pdf,
//       "base64"
//     );
//   });
// };

app.listen(process.env.PORT || 4000, () => {
  const directory = path.join(__dirname, "/uploads");

  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(directory, file), err => {
        if (err) throw err;
      });
    }
  });
});

//middleware
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));
const photoMiddleware = multer({ dest: "uploads" });
app.use(express.json());

cloudinary.config({
  cloud_name: "dweg2dkqj",
  api_key: "458517224595884",
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//database
mongoose
  .connect(process.env.DATABASE_URI)
  .then(console.log("Databse connected"));

//routes

app.get("/", (req, res) => {
  return res.send("ok");
});

app.get("/delete-all-accomodations", async (req, res) => {
  const response = await Place.deleteMany({});
  return res.json(response);
});

app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    //creating user in database
    const createdUser = await User.create({
      name,
      email,
      password: bcrypt.hashSync(password, bcryptSalt),
    });
    res.json(createdUser);
  } catch (e) {
    res.status(422).json(e);
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  //finding user
  const foundUser = await User.findOne({ email });
  if (foundUser) {
    //checking is password is correct
    const passOk = bcrypt.compareSync(password, foundUser.password);
    if (passOk) {
      //sending jwt
      jwt.sign(
        { email: foundUser.email, id: foundUser._id },
        jwtSecret,
        {},
        (err, token) => {
          if (err) {
            throw err;
          } else {
            res
              .cookie("token", token, { secure: true, sameSite: "none" })
              .json(foundUser);
          }
        }
      );
    } else {
      res.status(422).json("Incorrect Password");
    }
  } else {
    res.json("Not Found");
  }
});

app.get("/profile", (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, user) => {
      if (err) throw err;
      const { name, email, _id } = await User.findById(user.id);
      res.json({ name, email, _id });
    });
  } else {
    res.json(null);
  }
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json(true);
});

app.post("/upload-link", async (req, res) => {
  const { link } = req.body;
  const name = Date.now() + ".jpg";
  await imageDownloader.image({
    url: link,
    dest: __dirname + "/uploads/" + name,
  });
  cloudinary.uploader.upload(
    __dirname + "/uploads/" + name,
    { public_id: name },
    function (err, result) {
      if (err) {
        console.log(err);
      } else {
        console.log(result);
        res.json(result.secure_url);
      }
    }
  );
});

app.post("/upload", photoMiddleware.array("photos", 10), (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname } = req.files[i];
    const parts = originalname.split(".");
    const ext = parts[parts.length - 1];
    const newPath = path + "." + ext;
    fs.renameSync(path, newPath);
    uploadedFiles.push(newPath.replace("uploads\\", ""));
  }
  for (let i = 0; i < uploadedFiles.length; i++) {
    cloudinary.uploader.upload(
      uploadedFiles[i],
      { public_id: uploadedFiles[i].split(".")[0] },
      function (err, result) {
        if (err) {
          console.log(err);
        } else {
          console.log(result);
          res.json(result.secure_url);
        }
      }
    );
  }
  // res.json({ message: "Error eith cloudinary" });
});

app.post("/places", (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, user) => {
    if (err) throw err;
    const {
      title,
      address,
      addedPhotos,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    } = req.body;
    const place = Place.create({
      owner: user.id,
      title,
      address,
      photos: addedPhotos,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    });
    res.json(place);
  });
});

app.get("/user-places", async (req, res) => {
  jwt.verify(req.cookies.token, jwtSecret, {}, async (err, user) => {
    const { id } = user;
    res.json(await Place.find({ owner: id }));
  });
});

app.get("/places/:id", async (req, res) => {
  jwt.verify(req.cookies.token, jwtSecret, {}, async (err, user) => {
    const { id } = user;
    const { id: placeId } = req.params;
    res.json(await Place.findById(placeId));
  });
});

app.put("/place/:id", async (req, res) => {
  const { id } = req.params;
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, user) => {
    if (err) throw err;
    const place = await Place.findById(id);
    if (user.id === place.owner.toString()) {
      const {
        title,
        address,
        addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      } = req.body;
      place.set({
        title,
        address,
        photos: [...addedPhotos],
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      await place.save();
      res.json("ok");
    }
  });
});

app.get("/places", async (req, res) => {
  res.json(await Place.find());
});

// app.use("/book", require("./routes/payment"));

app.use("/bookings", async (req, res) => {
  jwt.verify(req.cookies.token, jwtSecret, {}, async (err, user) => {
    var { id } = user;
    id = new mongoose.Types.ObjectId(id);
    const bookings = await Booking.find({ client: id })
      .populate("place")
      .select("place");
    res.json(bookings);
  });
});

app.post("/booking-update", async (req, res) => {
  const booking = await Booking.create({
    place: req.body.place,
    client: req.body.client,
    guests: req.body.guests,
    days: req.body.days,
    from: req.body.from,
    to: req.body.to,
  });
  //
  const client = await User.findById(req.body.client);
  const place = await Place.findById(req.body.place);
  const data = {
    client: {
      company: client.name,
    },
    sender: {
      company: "Airbnb",
      address: "4th floor, statesman house, barakhamba road Connaught Place",
      zip: "110001 IN",
      city: "New Delhi",
      country: "India",
    },
    information: {
      number: new Date(),
      date: new Date().toLocaleDateString("en-GB"),
    },
    products: [
      {
        quantity: req.body.guests,
        description: place.title,
        price: req.body.days * place.price,
      },
    ],
    settings: {
      currency: "INR",
    },
  };
  // invoiceGenerator(data);
  res.send("ok");
});

app.use("/booking-check/:id", async (req, res) => {
  jwt.verify(req.cookies.token, jwtSecret, {}, async (err, user) => {
    let flag = 0;
    const { id: placeId } = req.params;
    const { id: clientId } = user;
    const placeObjectId = new mongoose.Types.ObjectId(placeId);
    const booking = await Booking.find({ place: placeObjectId }).populate(
      "place"
    );
    if (booking[0]?.client.toString() === clientId.toString()) {
      const { place, from, to, days } = booking[0];
      flag = 1;
      res.json({ place, flag, from, to, days });
    } else {
      const place = await Place.findById(placeId);
      res.json({ place, flag });
    }
  });
});

app.use("/booking-list/:id", async (req, res) => {
  const { id } = req.params;
  const placeObjectId = new mongoose.Types.ObjectId(id);
  const bookings = await Booking.find({ place: placeObjectId })
    .populate("client")
    .select("client guests from to days");
  res.json(bookings);
});

//PAYMENT

app.use("/payment", payment);
