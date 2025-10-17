import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from "./libs/db.js";
import userRouter from "./routes/userRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";

// Creating Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Initialzing a socket.io server
export const io = new Server(server, { cors: { origin: "*" } }); // accept message from anywere

// create a map to store online users
export const userSocketMap = {}; // {userId: socketId}
// building a socket.io connetion handler
io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  console.log("User connected", userId);
  if (userId) userSocketMap[userId] = socket.id;
  // Emit online users to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
  // delete user when disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected", userId);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});
// Middleware setup
app.use(express.json({ limit: "4mb" }));
app.use(cors());

// setting up the routes
app.use("/api/status", (req, res) => res.send("Server is live"));
// adding the userRouter
app.use("/api/auth", userRouter);
// adding the messageRouter
app.use("/api/message", messageRouter);
// connected to MONGODB
await connectDB();
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log("Server is running on PORT: " + PORT));
