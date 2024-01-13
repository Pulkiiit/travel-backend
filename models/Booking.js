const mongoose = require("mongoose");

const BookingSchema = new mongoose.Schema({
  place: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Place",
    required: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  guests: {
    type: Number,
    required: true,
  },
  from: {
    type: String,
    required: true,
  },
  to: {
    type: String,
    required: true,
  },
  days: {
    type: Number,
    required: true,
  },
});

const BookingModel = mongoose.model("Booking", BookingSchema);

module.exports = BookingModel;
