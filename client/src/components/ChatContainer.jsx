import React, { useContext, useEffect, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMeassageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import { CallContext } from "../../context/CallContext";
import {
  Video,
  Phone,
  Sparkles,
  ChevronDown,
  LoaderCircle,
  X,
} from "lucide-react";
import InlineCallUI from "./call/InlineCallUI";
import toast from "react-hot-toast";

const SUMMARY_OPTIONS = [
  { label: "Last 1 hour", value: "1h" },
  { label: "Last 2 hours", value: "2h" },
  { label: "Last 5 hours", value: "5h" },
  { label: "Last 1 day", value: "24h" },
  { label: "Last 2 days", value: "48h" },
  { label: "Last 5 days", value: "120h" },
  { label: "Entire chat", value: "entire" },
  { label: "Custom hours", value: "custom" },
];

const ChatContainer = () => {
  const {
    messages,
    selectedUser,
    sendMessages,
    setSelectedUser,
    getMessages,
    getChatSummary,
    chatSummary,
    summaryLoading,
    smartReplies,
    smartReplyLoading,
    getSmartReplies,
  } = useContext(ChatContext);
  const { authUser, onlineUsers, socket } = useContext(AuthContext);
  const { startCall, inCall } = useContext(CallContext);
  const scrollEnd = useRef();
  const typingTimeoutRef = useRef();
  const smartReplyKeyRef = useRef("");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [showSummaryMenu, setShowSummaryMenu] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState("24h");
  const [customHours, setCustomHours] = useState("");

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

  const handleSummarySelection = async (timeframeValue) => {
    setSelectedTimeframe(timeframeValue);

    if (timeframeValue === "custom") {
      return;
    }

    const data = await getChatSummary({ timeframe: timeframeValue, limit: 40 });

    if (data) {
      setShowSummaryPanel(true);
      setShowSummaryMenu(false);
    }
  };

  const handleCustomSummary = async () => {
    if (!customHours || Number(customHours) <= 0) {
      toast.error("Enter a valid number of hours.");
      return;
    }

    const data = await getChatSummary({
      timeframe: "custom",
      customHours,
      limit: 40,
    });

    if (data) {
      setShowSummaryPanel(true);
      setShowSummaryMenu(false);
    }
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

  useEffect(() => {
    if (!socket) return;

    const handleUserTyping = ({ userId }) => {
      if (userId !== authUser._id) {
        setTypingUser(userId);
      }
    };

    const handleUserStopTyping = ({ userId }) => {
      if (userId !== authUser._id) {
        setTypingUser(null);
      }
    };

    socket.on("userTyping", handleUserTyping);
    socket.on("userStopTyping", handleUserStopTyping);

    return () => {
      socket.off("userTyping", handleUserTyping);
      socket.off("userStopTyping", handleUserStopTyping);
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

  useEffect(() => {
    if (!selectedUser || !messages.length) return;

    const lastMessage = messages[messages.length - 1];
    const sentByOtherUser =
      String(lastMessage.senderId) !== String(authUser._id);

    if (!sentByOtherUser) {
      return;
    }

    const requestKey = `${selectedUser._id}:${lastMessage._id || lastMessage.createdAt || lastMessage.text}`;

    if (smartReplyKeyRef.current === requestKey) {
      return;
    }

    smartReplyKeyRef.current = requestKey;

    const timer = setTimeout(() => {
      getSmartReplies({ limit: 10 });
    }, 700);

    return () => clearTimeout(timer);
  }, [selectedUser, messages, authUser._id, getSmartReplies]);

  useEffect(() => {
    setShowSummaryMenu(false);
    setShowSummaryPanel(false);
    setSelectedTimeframe("24h");
    setCustomHours("");
    smartReplyKeyRef.current = "";
  }, [selectedUser?._id]);

  return selectedUser ? (
    <div className="h-full overflow-scroll flex flex-col relative backdrop-blur-xl bg-gradient-to-br from-[#1e1b3a]/70 via-[#2d2a4a]/60 to-[#1e1b3a]/70 border border-white/10 shadow-lg">
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

        <div className="relative">
          <button
            onClick={() => setShowSummaryMenu((prev) => !prev)}
            className="flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-100 hover:bg-violet-500/20"
          >
            {summaryLoading ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            Summary
            <ChevronDown size={14} />
          </button>

          {showSummaryMenu && (
            <div className="absolute right-0 top-11 z-20 w-56 rounded-xl border border-white/10 bg-[#1f1b38] p-2 shadow-xl">
              <p className="px-2 pb-2 text-[11px] text-gray-400">
                Choose a timeframe
              </p>

              {SUMMARY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSummarySelection(option.value)}
                  className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                    selectedTimeframe === option.value
                      ? "bg-violet-500/20 text-violet-100"
                      : "text-gray-200 hover:bg-white/5"
                  }`}
                >
                  {option.label}
                </button>
              ))}

              {selectedTimeframe === "custom" && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={customHours}
                    onChange={(e) => setCustomHours(e.target.value)}
                    placeholder="Enter hours"
                    className="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white outline-none"
                  />
                  <button
                    onClick={handleCustomSummary}
                    className="mt-2 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-700"
                  >
                    Generate summary
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

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

      {showSummaryPanel && chatSummary && !inCall && (
        <div className="mx-4 mt-3 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-sm text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-violet-100">
                <Sparkles size={16} /> AI chat summary
              </p>
              <p className="text-xs text-gray-300">
                {chatSummary.timeframeLabel} • {chatSummary.messageCount}{" "}
                message(s)
              </p>
            </div>
            <button
              onClick={() => setShowSummaryPanel(false)}
              className="text-gray-300 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mt-2 text-gray-100">{chatSummary.summary}</p>

          {chatSummary.bullets?.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-200">
              {chatSummary.bullets.map((point, index) => (
                <li key={`${point}-${index}`}>{point}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/*---------- chat area -----------*/}
      {inCall ? (
        <InlineCallUI />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-2">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex w-full items-end gap-2 justify-end ${
                msg.senderId !== authUser._id && "flex-row-reverse"
              }`}
            >
              <div className="max-w-[80%] md:max-w-[74%]">
                {msg.image ? (
                  <img
                    src={msg.image}
                    alt=""
                    className="w-full max-w-[460px] rounded-2xl border border-white/10 shadow-md"
                  />
                ) : (
                  <p
                    className={`w-full px-4 py-2.5 md:text-sm rounded-2xl shadow-sm whitespace-pre-wrap [overflow-wrap:anywhere] ${
                      msg.senderId === authUser._id
                        ? "rounded-br-md bg-violet-500/30 border border-violet-300/35 text-white"
                        : "rounded-bl-md bg-slate-100/10 border border-slate-200/20 text-slate-100"
                    }`}
                  >
                    {msg.text}
                  </p>
                )}
              </div>
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
                <p className="text-gray-400 mt-1">
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

      {/*--------- smart replies ------------*/}
      {!inCall && (
        <div className="px-3 pb-2">
          {smartReplyLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <LoaderCircle size={14} className="animate-spin" />
              Generating smart replies...
            </div>
          ) : smartReplies.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {smartReplies.map((reply, index) => (
                <button
                  key={`${reply}-${index}`}
                  onClick={() => setInput(reply)}
                  className="rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-100 hover:bg-violet-500/20"
                >
                  {reply}
                </button>
              ))}
            </div>
          ) : null}
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

                if (!isTyping) {
                  setIsTyping(true);
                  socket.emit("typing", { chatId: selectedUser._id });
                }

                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }

                typingTimeoutRef.current = setTimeout(() => {
                  socket.emit("stopTyping", { chatId: selectedUser._id });
                  setIsTyping(false);
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
