import { useContext, useEffect, useState, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { ChatContext } from "./ChatContext";

import toast from "react-hot-toast";

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [chatSummary, setChatSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [smartReplies, setSmartReplies] = useState([]);
  const [smartReplyLoading, setSmartReplyLoading] = useState(false);
  const { socket, axios } = useContext(AuthContext);

  // 1. Get all users (Memoized to prevent infinite loops)
  const getUsers = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages || {});
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, [axios]);

  // 2. Get messages for selected user (Memoized)
  const getMessages = useCallback(
    async (userId) => {
      try {
        const { data } = await axios.get(`/api/messages/${userId}`);
        if (data.success) {
          setMessages(data.messages);
        }
      } catch (error) {
        toast.error(error.message);
      }
    },
    [axios],
  );

  // 3. Send message
  const sendMessages = async (messageData) => {
    try {
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData,
      );
      if (data.success) {
        setMessages((prev) => [...prev, data.newMessage]);
        getUsers();
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getChatSummary = useCallback(
    async ({ timeframe = "24h", customHours = "", limit = 40 } = {}) => {
      if (!selectedUser?._id) return null;

      setSummaryLoading(true);

      try {
        const { data } = await axios.post("/api/ai/summary", {
          selectedUserId: selectedUser._id,
          timeframe,
          customHours,
          limit,
        });

        if (data.success) {
          setChatSummary(data);
          return data;
        }
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Unable to generate chat summary.",
        );
      } finally {
        setSummaryLoading(false);
      }

      return null;
    },
    [axios, selectedUser],
  );

  const getSmartReplies = useCallback(
    async ({ limit = 12 } = {}) => {
      if (!selectedUser?._id) return [];

      setSmartReplyLoading(true);

      try {
        const { data } = await axios.post("/api/ai/smart-replies", {
          selectedUserId: selectedUser._id,
          limit,
        });

        if (data.success) {
          const uniqueReplies = [
            ...new Set((data.replies || []).filter(Boolean)),
          ];
          setSmartReplies(uniqueReplies.slice(0, 3));
          return uniqueReplies;
        }
      } catch (error) {
        console.error("Unable to get smart replies:", error.message);
      } finally {
        setSmartReplyLoading(false);
      }

      setSmartReplies([]);
      return [];
    },
    [axios, selectedUser],
  );

  // 4. Socket Listener for New Messages
  // This effect handles real-time updates and cleanup automatically
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      const isChattingWithSender = selectedUser?._id === newMessage.senderId;

      if (isChattingWithSender) {
        // Add to current chat and mark as seen on backend
        setMessages((prev) => [...prev, { ...newMessage, seen: true }]);
        axios.put(`/api/messages/mark/${newMessage._id}`).catch(() => {});
      } else {
        // Increment unseen count for the specific sender
        setUnseenMessages((prev) => ({
          ...prev,
          [newMessage.senderId]: (prev[newMessage.senderId] || 0) + 1,
        }));
      }
      // Refresh user list to show latest message preview/dot
      getUsers();
    };

    socket.on("newMessage", handleNewMessage);

    return () => {
      socket.off("newMessage", handleNewMessage);
    };
  }, [socket, selectedUser, getUsers, axios]);

  useEffect(() => {
    setChatSummary(null);
    setSmartReplies([]);
  }, [selectedUser?._id]);

  const value = {
    messages,
    users,
    selectedUser,
    getUsers,
    getMessages,
    sendMessages,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    chatSummary,
    summaryLoading,
    getChatSummary,
    smartReplies,
    smartReplyLoading,
    getSmartReplies,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
