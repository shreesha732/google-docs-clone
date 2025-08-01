// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const socketIO = require("socket.io");
require("dotenv").config();
const Document = require("./models/Document");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000", // Change to Vercel frontend URL after deploy
    methods: ["GET", "POST"],
  },
});

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

const defaultValue = "";

// ✅ Realtime Socket.io Logic
io.on("connection", socket => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("get-document", async (documentId, userId) => {
    const document = await findOrCreateDocument(documentId, userId);
    socket.join(documentId);
    socket.emit("load-document", document.data);

    socket.on("send-changes", delta => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async data => {
      await Document.findByIdAndUpdate(documentId, { data });
    });
  });
});

// ✅ Save new document with user ID
async function findOrCreateDocument(id, userId) {
  if (id == null) return;

  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue, userId });
}

// ✅ REST API to get all documents for a user
// ✅ REST API to get all documents for a user
app.get("/api/user-documents/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const docs = await Document.find({ userId }, "_id");
    res.json(docs);
  } catch (err) {
    console.error("Failed to fetch docs:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
