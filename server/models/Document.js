const mongoose = require("mongoose");

const DocumentSchema = new mongoose.Schema({
  _id: String,
  data: Object,
  userId: String, // Track user ownership
});

module.exports = mongoose.model("Document", DocumentSchema);
