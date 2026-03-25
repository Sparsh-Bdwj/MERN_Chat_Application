import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./libs/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";

// Creating Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialzing a socket.io server
export const io = new Server(server, { cors: { origin: "*" } }); // accept message from anywere

// object which will store all the userId's
export const userSocketMap = {};

// handle user connect
io.on("connection", (socket) => {
  // console.log("🔥 New raw socket connection:", socket.id);
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      console.log("No token provided");
      return socket.disconnect();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);

    const userId = decoded._id || decoded.id || decoded.userId;

    if (!userId) {
      console.log("Invalid token payload");
      return socket.disconnect();
    }

    socket.userId = userId;

    console.log("user connected:", userId);

    if (!userSocketMap[userId]) {
      userSocketMap[userId] = [];
    }

    userSocketMap[userId].push(socket.id);

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("disconnect", () => {
      console.log("user disconnected:", userId);

      if (userSocketMap[userId]) {
        userSocketMap[userId] = userSocketMap[userId].filter(
          (id) => id !== socket.id,
        );

        if (userSocketMap[userId].length === 0) {
          delete userSocketMap[userId];
        }
      }

      io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });

    socket.on("joinChat", (chatId) => {
      socket.join(chatId);
    });

    socket.on("typing", ({ chatId }) => {
      const recipientSockets = userSocketMap[chatId];

      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("userTyping", {
            userId: socket.userId,
          });
        });
      }
    });

    socket.on("stopTyping", ({ chatId }) => {
      const recipientSockets = userSocketMap[chatId];

      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("userStopTyping", {
            userId: socket.userId,
          });
        });
      }
    });
    /* ============================= */
    /*  WEBRTC CALL EVENTS */
    /* ============================= */

    // Call user
    socket.on("callUser", ({ to, offer, callType }) => {
      console.log("📞 callUser:", socket.userId, "→", to);

      const recipientSockets = userSocketMap[to];

      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("incomingCall", {
            from: socket.userId,
            offer,
            callType, // "video" or "audio"
          });
        });
      }
    });

    // Accept call
    socket.on("acceptCall", ({ to, answer }) => {
      console.log("✅ acceptCall:", socket.userId);

      const recipientSockets = userSocketMap[to];

      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("callAccepted", {
            from: socket.userId,
            answer,
          });
        });
      }
    });

    // Reject call
    socket.on("rejectCall", ({ to }) => {
      console.log("❌ rejectCall:", socket.userId);

      const recipientSockets = userSocketMap[to];

      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("callRejected", {
            from: socket.userId,
          });
        });
      }
    });

    // ICE Candidate
    socket.on("iceCandidate", ({ to, candidate }) => {
      const recipientSockets = userSocketMap[to];

      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("iceCandidate", {
            from: socket.userId,
            candidate,
          });
        });
      }
    });

    // End Call
    socket.on("endCall", ({ to }) => {
      console.log("📴 endCall:", socket.userId);

      const recipientSockets = userSocketMap[to];

      if (recipientSockets) {
        recipientSockets.forEach((socketId) => {
          io.to(socketId).emit("callEnded", {
            from: socket.userId,
          });
        });
      }
    });
  } catch (error) {
    console.log("Socket auth error:", error.message);
    socket.disconnect();
  }
});

// Middleware setup
app.use(express.json({ limit: "4mb" }));
app.use(cors());

// setting up the routes
app.use("/api/status", (req, res) => res.send("Server is live"));
// adding the userRouter
app.use("/api/auth", userRouter);
// adding the messageRouter
app.use("/api/messages", messageRouter);
// connected to MONGODB
await connectDB();
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log("Server is running on PORT: " + PORT));
