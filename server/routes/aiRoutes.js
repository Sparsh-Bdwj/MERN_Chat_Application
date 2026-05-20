import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
  getAiHealth,
  getChatSummary,
  getSmartReplies,
} from "../controllers/aiController.js";

const aiRouter = express.Router();

aiRouter.get("/health", protectRoute, getAiHealth);
aiRouter.post("/summary", protectRoute, getChatSummary);
aiRouter.post("/smart-replies", protectRoute, getSmartReplies);

export default aiRouter;
