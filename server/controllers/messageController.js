import User from "../models/User.js";
import Message from "../models/Message.js";
import cloudinary from "../libs/cloudinary.js";
import { io, userSocketMap } from "../index.js";

// contorller to get all users expect the logged in user and the unseen messages of the logged in user
export const getUsersForSidebar = async (req, res) => {
  try {
    const userId = req.user._id;
    const filterUser = await User.find({ _id: { $ne: userId } }).select(
      "-password"
    );
    // count no of message not seen
    const unseenMessage = {};
    const promises = filterUser.map(async (user) => {
      const message = await Message.find({
        senderId: user._id,
        receiverId: userId,
        seen: false,
      });
      if (message.length > 0) {
        unseenMessage[user._id] = message.length;
      }
    });
    await Promise.all(promises);
    return res
      .status(200)
      .json({ success: true, users: filterUser, unseenMessage });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// controller to get all messages for the selected user
export const getAllMessages = async (req, res) => {
  try {
    const { id: selectedUserId } = req.params;
    const myId = req.user._id;
    if (!selectedUserId) {
      return res
        .status(400)
        .json({ success: false, messages: "User Id required" });
    }
    const messages = await Message.find({
      $or: [
        { senderId: selectedUserId, receiverId: myId },
        { senderId: myId, receiverId: selectedUserId },
      ],
    }).sort({ createdAt: 1 }); // sort so message appear oldest to newest
    await Message.updateMany(
      {
        senderId: selectedUserId,
        receiverId: myId,
      },
      { seen: true }
    );
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// api to mark message as seen using message id
export const markMessageSeen = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "User Id required" });
    }
    await Message.findByIdAndUpdate(id, { seen: true });
    res.status(200).json({ success: true, message: "Marked message as seen" });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// send message to selected user
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image, {
        folder: "chat_images",
        resource_type: "auto",
      });
      imageUrl = uploadResponse.secure_url;
    }
    const newMessage = await Message.create({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });
    // Emit newMessage to the receiver's socket
    const receiverSocketId = userSocketMap[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
    res.status(200).json({ success: true, newMessage });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
