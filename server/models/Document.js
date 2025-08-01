const DocumentSchema = new mongoose.Schema({
  _id: String,
  data: Object,
  userId: String, // 👈 Add this
});

module.exports = mongoose.model("Document", DocumentSchema);
