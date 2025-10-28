import { createContext, useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
const backendUrl = import.meta.env.VITE_BACKEND_URL;
export const AuthContext = createContext();
// set default axios url
axios.defaults.baseURL = backendUrl;

export const AuthProvider = ({ children }) => {
  // adding default states which will we pass alonged the context provider
  const [token, setToken] = useState(localStorage.getItem("token")); // fetch the token from the browser
  const [authUser, setAuthUser] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  // check is the user is authenticated and if so, set the user data and connect the socket
  const checkAuth = async () => {
    try {
      const { data } = await axios.get("/api/auth/check");
      if (data.success) {
        setAuthUser(data.user);
        connectSocket(data.user);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setToken(token);
      checkAuth();
    }
  }, []);
  // login function to handle user authentication and socket connection
  const login = async (state, credentials) => {
    try {
      const { data } = await axios.post(`/api/auth/${state}`, credentials);
      if (data.success) {
        setAuthUser(data.userData);
        connectSocket(data.userData);
        axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
        setToken(data.token);
        localStorage.setItem("token", data.token);
        toast.success(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  // logout function to handle user authentication and socket disconnection
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setAuthUser(null);
    setOnlineUsers([]);
    axios.defaults.headers.common["token"] = null;
    toast.success("Logged out successfully");
    socket.disconnect();
  };
  // Update profile function to handle user profile updates
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

  // connect socket function to handle socket connection and online users updates
  // const connectSocket = (userData) => {
  //   if (!userData?._id) return;
  //   if (socket) socket.disconnect();
  //   const newSocket = io(backendUrl, {
  //     query: {
  //       userId: userData._id,
  //     },
  //   });
  //   newSocket.connect();
  //   setSocket(newSocket);
  //   newSocket.on("getOnlineUserss", (userIds) => {
  //     setOnlineUsers(userIds);
  //   });
  // };
  const connectSocket = (userData) => {
    if (!userData?._id) return;

    // If a socket already exists, disconnect before reconnecting
    if (socket) {
      socket.disconnect();
    }

    const newSocket = io(backendUrl, {
      query: { userId: userData._id },
      transports: ["websocket"], // added for real time usecase
      reconnection: true,
    });

    // ✅ Register listeners only once
    newSocket.once("connect", () => {
      console.log("🟢 Socket connected for:", userData.fullName);
    });

    newSocket.on("getOnlineUsers", (userIds) => {
      setOnlineUsers(userIds || []);
    });

    newSocket.once("disconnect", () => {
      console.log("🔴 Socket disconnected for:", userData.fullName);
    });
    setSocket(newSocket);
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
