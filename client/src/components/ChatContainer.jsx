import React, { useContext, useEffect, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMeassageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/authContext";
import { CallContext } from "../../context/callContext";
import { Video, Phone } from "lucide-react";
import InlineCallUI from "./call/InlineCallUI";
import toast from "react-hot-toast";

const ChatContainer = () => {
  const { messages, selectedUser, sendMessages, setSelectedUser, getMessages } =
    useContext(ChatContext);
  const { authUser, onlineUsers, socket } = useContext(AuthContext);
  const { startCall, inCall } = useContext(CallContext);
  console.log("This is the incall log " + inCall);
  const scrollEnd = useRef();
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const typingTimeoutRef = useRef();
  // handling sennding a message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() === "") return null;
    await sendMessages({ text: input.trim() });
    setInput("");
    if (socket && selectedUser) {
      socket.emit("stopTyping", { chatId: selectedUser._id });
    }
    setIsTyping(false);
  };
  // handling sending a image
  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("select an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      await sendMessages({ image: reader.result });
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  };

  // useEffect
  useEffect(() => {
    if (!socket) return;
    socket.on("userTyping", ({ userId }) => {
      console.log("user is typing....");
      if (userId !== authUser._id) {
        setTypingUser(userId);
      }
    });
    socket.on("userStopTyping", ({ userId }) => {
      if (userId != authUser._id) {
        console.log("user stop typing");
        setTypingUser(null);
      }
    });
    return () => {
      socket.off("userTyping");
      socket.off("userStopTyping");
    };
  }, [socket, authUser._id]);

  // join the chat room when user is seleted
  useEffect(() => {
    if (!socket || !selectedUser) return;
    socket.emit("joinChat", selectedUser._id);
  }, [socket, selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      getMessages(selectedUser._id);
    }
  }, [selectedUser, getMessages]);
  useEffect(() => {
    if (scrollEnd.current) {
      scrollEnd.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, typingUser]);
  return selectedUser ? (
    <div
      className="h-full overflow-scroll flex flex-col relative backdrop-blur-xl bg-gradient-to-br from-[#1e1b3a]/70 via-[#2d2a4a]/60 to-[#1e1b3a]/70 border border-white/10 shadow-lg
"
    >
      {/*---------- header -----------*/}
      <div className="flex items-center gap-3 py-3 mx-4 border-b border-stone-500">
        <img
          src={selectedUser.profilePic || assets.avatar_icon}
          alt=""
          className="w-8 rounded-full"
        />
        <p className="flex-1 text-lg text-white flex items-center gap-2">
          {selectedUser.fullName}
          {onlineUsers.includes(selectedUser._id) && (
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
          )}
        </p>
        <img
          onClick={() => setSelectedUser(null)}
          src={assets.arrow_icon}
          alt=""
          className="max-md:hidden max-w-5"
        />
        <button
          onClick={() => startCall(selectedUser._id, "video")}
          className="ml-2 text-white"
        >
          <Video size={23} />
        </button>

        <button
          onClick={() => startCall(selectedUser._id, "audio")}
          className="ml-2 text-white"
        >
          <Phone size={20} />
        </button>
        <img src={assets.help_icon} alt="" className="max-md:hidden max-w-5" />
      </div>
      {/*---------- chat area -----------*/}
      {inCall ? (
        <InlineCallUI />
      ) : (
        <div className="flex-1 overflow-y-auto p-3 py-20 flex flex-col">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 justify-end ${
                msg.senderId !== authUser._id && "flex-row-reverse"
              }`}
            >
              {msg.image ? (
                <img
                  src={msg.image}
                  alt=""
                  className="max-w-[230px]  border border-gray-700 rounded-lg overflow-hidden mb-8"
                />
              ) : (
                <p
                  className={`p-2 max-w-[200px] md:text-sm font-light rounded-lg mb-8 break-all bg-violet-500/30 text-white ${
                    msg.senderId === authUser._id
                      ? "rounded-br-none"
                      : "rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </p>
              )}
              <div className="text-center text-xs">
                <img
                  src={
                    msg.senderId === authUser._id
                      ? authUser.profilePic || assets.avatar_icon
                      : selectedUser?.profilePic || assets.avatar_icon
                  }
                  alt=""
                  className="w-7 rounded-full"
                />
                <p className="text-gray-500">
                  {formatMeassageTime(msg.createdAt)}
                </p>
              </div>
            </div>
          ))}
          {typingUser === selectedUser._id && (
            <div className="text-sm text-gray-400 px-3 py-2 animate-pulse">
              {selectedUser.fullName} is typing...
            </div>
          )}
          <div ref={scrollEnd}></div>
        </div>
      )}
      {/*--------- bottom area ------------*/}
      {!inCall && (
        <div className="bottom-0 left-0 right-0 flex items-center gap-3 p-3">
          <div className="flex-1 flex items-center bg-gray-100/12 px-3 rounded-full ">
            <input
              type="text"
              onChange={(e) => {
                setInput(e.target.value);
                if (!socket || !selectedUser) return;

                // 1. Tell the server I started typing
                if (!isTyping) {
                  setIsTyping(true);
                  socket.emit("typing", { chatId: selectedUser._id });
                }

                // 2. Clear the existing timer so the "stop" event doesn't fire too early
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }

                // 3. Set a new timer to tell the server I stopped
                typingTimeoutRef.current = setTimeout(() => {
                  socket.emit("stopTyping", { chatId: selectedUser._id });
                  setIsTyping(false); // This allows the NEXT keypress to trigger the "typing" emit again
                }, 1000);
              }}
              onKeyDown={(e) =>
                e.key === "Enter" ? handleSendMessage(e) : null
              }
              value={input}
              placeholder="send a message"
              className="flex-1 text-sm p-3 border-none rounded-lg outline-none text-white placeholder-gray-400 "
            />
            <input
              onChange={handleSendImage}
              type="file"
              id="image"
              accept="image/png, image/jpeg"
              hidden
            />
            <label htmlFor="image">
              <img
                src={assets.gallery_icon}
                alt=""
                className="w-5 mr-2 cursor-pointer"
              />
            </label>
          </div>
          <img
            onClick={handleSendMessage}
            src={assets.send_button}
            alt=""
            className="w-7 cursor-pointer"
          />
        </div>
      )}
    </div>
  ) : (
    <div className="flex flex-col items-center justify-center gap-3 text-gray-300 bg-white/10 max-md:hidden py-10 rounded-r-xl">
      {/* Logo (bigger version) */}
      <div className="flex items-center gap-2 select-none">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
          💬
        </div>
        <h1 className="text-4xl font-semibold bg-gradient-to-r from-purple-400 to-violet-600 bg-clip-text text-transparent tracking-wide">
          MERN<span className="font-normal text-gray-300">chat</span>
        </h1>
      </div>

      {/* Tagline */}
      <p className="text-lg font-medium text-white opacity-80 mt-2">
        Chat anytime, anywhere
      </p>
    </div>
  );
};

export default ChatContainer;
