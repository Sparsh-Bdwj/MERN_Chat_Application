import Message from "../models/Message.js";
import User from "../models/User.js";
import {
  checkAiConnection,
  generateChatSummary,
  generateReplySuggestions,
  getAiRuntimeConfig,
} from "../services/aiService.js";

const PRESET_HOURS = {
  "1h": 1,
  "2h": 2,
  "5h": 5,
  "24h": 24,
  "48h": 48,
  "120h": 120,
};

const getTimeframeDetails = (timeframe, customHours) => {
  if (!timeframe || timeframe === "24h") {
    return {
      since: new Date(Date.now() - 24 * 60 * 60 * 1000),
      label: "the last 24 hours",
    };
  }

  if (timeframe === "entire") {
    return {
      since: null,
      label: "the entire chat",
    };
  }

  if (timeframe === "custom") {
    const parsedHours = Number(customHours);

    if (!Number.isFinite(parsedHours) || parsedHours <= 0 || parsedHours > 720) {
      throw new Error("Custom timeframe must be between 1 and 720 hours.");
    }

    return {
      since: new Date(Date.now() - parsedHours * 60 * 60 * 1000),
      label: `the last ${parsedHours} hour(s)`,
    };
  }

  if (PRESET_HOURS[timeframe]) {
    return {
      since: new Date(Date.now() - PRESET_HOURS[timeframe] * 60 * 60 * 1000),
      label:
        PRESET_HOURS[timeframe] >= 24
          ? `the last ${PRESET_HOURS[timeframe] / 24} day(s)`
          : `the last ${PRESET_HOURS[timeframe]} hour(s)`,
    };
  }

  throw new Error("Unsupported timeframe option.");
};

const formatConversation = (messages, myId, otherUserName) => {
  return messages
    .map((message) => {
      const isMine = String(message.senderId) === String(myId);
      const senderLabel = isMine ? "You" : otherUserName || "Other user";
      const content = [message.text?.trim(), message.image ? "[shared an image]" : ""]
        .filter(Boolean)
        .join(" ");

      return {
        senderLabel,
        content,
        image: Boolean(message.image),
        createdAt: message.createdAt,
      };
    })
    .filter((message) => message.content);
};

export const getAiHealth = async (req, res) => {
  try {
    const status = await checkAiConnection();

    return res.status(200).json({
      success: true,
      ...status,
    });
  } catch (error) {
    const config = getAiRuntimeConfig();

    return res.status(503).json({
      success: false,
      ...config,
      message: error.message || "AI service is unavailable.",
    });
  }
};

export const getChatSummary = async (req, res) => {
  try {
    const { selectedUserId, timeframe = "24h", customHours = "", limit = 80 } = req.body;
    const myId = req.user._id;

    if (!selectedUserId) {
      return res.status(400).json({
        success: false,
        message: "A user must be selected to summarize the chat.",
      });
    }

    const { since, label } = getTimeframeDetails(timeframe, customHours);
    const selectedUser = await User.findById(selectedUserId).select("fullName");

    const query = {
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    };

    if (since) {
      query.createdAt = { $gte: since };
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 80, 10), 200);
    const messages = await Message.find(query).sort({ createdAt: 1 }).limit(safeLimit);
    const formattedMessages = formatConversation(messages, myId, selectedUser?.fullName);
    const transcript = formattedMessages
      .map(
        (message) =>
          `[${new Date(message.createdAt).toISOString()}] ${message.senderLabel}: ${message.content}`,
      )
      .join("\n");

    const result = await generateChatSummary({
      transcript,
      messages: formattedMessages,
      timeframeLabel: label,
    });

    return res.status(200).json({
      success: true,
      summary: result.summary,
      bullets: result.bullets,
      timeframeLabel: label,
      messageCount: formattedMessages.length,
      source: result.source,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to generate summary.",
    });
  }
};

export const getSmartReplies = async (req, res) => {
  try {
    const { selectedUserId, limit = 20 } = req.body;
    const myId = req.user._id;

    if (!selectedUserId) {
      return res.status(400).json({
        success: false,
        message: "A user must be selected to generate smart replies.",
      });
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 20, 6), 40);
    const selectedUser = await User.findById(selectedUserId).select("fullName");

    const recentMessages = await Message.find({
      $or: [
        { senderId: myId, receiverId: selectedUserId },
        { senderId: selectedUserId, receiverId: myId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(safeLimit);

    const orderedMessages = recentMessages.reverse();
    const formattedMessages = formatConversation(orderedMessages, myId, selectedUser?.fullName);
    const transcript = formattedMessages
      .map(
        (message) =>
          `[${new Date(message.createdAt).toISOString()}] ${message.senderLabel}: ${message.content}`,
      )
      .join("\n");

    const replies = await generateReplySuggestions({
      transcript,
      messages: formattedMessages,
    });

    return res.status(200).json({
      success: true,
      replies,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({
      success: false,
      message: error.message || "Unable to generate smart replies.",
    });
  }
};
