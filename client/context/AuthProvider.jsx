import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";
const backendUrl = import.meta.env.VITE_BACKEND_URL;
// set default axios url
axios.defaults.baseURL = backendUrl;

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authUser, setAuthUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
  }, []);

  const connectSocket = useCallback(
    (userData, userToken) => {
      const activeToken = userToken || token || localStorage.getItem("token");

      if (!userData?._id || !activeToken) return;

      if (
        socketRef.current?.connected &&
        socketRef.current.userId === userData._id
      ) {
        return;
      }

      disconnectSocket();

      const newSocket = io(backendUrl, {
        auth: { token: activeToken },
        transports: ["websocket"],
        reconnection: true,
      });

      newSocket.userId = userData._id;

      newSocket.on("connect", () => {
        console.log("🟢 Socket connected for:", userData.fullName);
      });

      newSocket.on("getOnlineUsers", (userIds) => {
        setOnlineUsers(userIds || []);
      });

      newSocket.on("disconnect", (reason) => {
        console.log(
          "Socket disconnected for:",
          userData.fullName,
          "Reason:",
          reason,
        );

        if (reason === "io server disconnect") {
          localStorage.removeItem("token");
          setToken(null);
          setAuthUser(null);
          setOnlineUsers([]);
          delete axios.defaults.headers.common["Authorization"];
        }
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    },
    [disconnectSocket, token],
  );

  const checkAuth = useCallback(
    async (currentToken) => {
      try {
        const { data } = await axios.get("/api/auth/check");
        if (data.success) {
          setAuthUser(data.user);
          connectSocket(data.user, currentToken);
        }
      } catch (error) {
        toast.error(error.message);
      }
    },
    [connectSocket],
  );

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      checkAuth(token);
    } else {
      delete axios.defaults.headers.common["Authorization"];
      setOnlineUsers([]);
      disconnectSocket();
    }
  }, [token, checkAuth, disconnectSocket]);

  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/api/auth/${state}`, credentials);
      if (data.success) {
        setAuthUser(data.userData);
        axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
        localStorage.setItem("token", data.token);
        setToken(data.token);
        toast.success(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setOnlineUsers([]);
    disconnectSocket();
    delete axios.defaults.headers.common["Authorization"];
    toast.success("Logged out successfully");
  };

  const updateProfile = async (body) => {
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.put("/api/auth/update-profile", body, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (data.success) {
        setAuthUser(data.user);
        toast.success("Profile Updated successfully");
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const value = {
    axios,
    authUser,
    onlineUsers,
    socket,
    login,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
