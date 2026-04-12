import React, { useContext } from "react";
import assets from "../../assets/assets";
import { CallContext } from "../../../context/CallContext";
import { ChatContext } from "../../../context/ChatContext";
import { AuthContext } from "../../../context/AuthContext";
import { Mic, Phone, PhoneOff } from "lucide-react";

const InlineCallUI = () => {
  const { localVideoRef, remoteVideoRef, endCall, callType } =
    useContext(CallContext);
  const { selectedUser } = useContext(ChatContext);
  const { authUser } = useContext(AuthContext);

  if (callType === "audio") {
    return (
      <div className="flex-1 relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0f172a] via-[#1d1b3a] to-[#312e81] text-white">
        <video ref={remoteVideoRef} autoPlay playsInline className="hidden" />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="hidden"
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.22),transparent_45%)]" />

        <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 py-8">
          <div className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2 text-sm text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Audio call connected
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <Phone size={14} />
              Secure voice call
            </div>
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 animate-pulse rounded-full bg-violet-500/30 blur-2xl" />
              <img
                src={selectedUser?.profilePic || assets.avatar_icon}
                alt={selectedUser?.fullName || "User"}
                className="relative h-28 w-28 rounded-full border-4 border-white/20 object-cover shadow-2xl"
              />
            </div>

            <h2 className="text-2xl font-semibold tracking-wide">
              {selectedUser?.fullName || "Voice Call"}
            </h2>
            <p className="mt-2 text-sm text-violet-100/80">
              In audio call • speak naturally and clearly
            </p>

            <div className="mt-5 flex items-end gap-1">
              {[18, 28, 14, 34, 20].map((height, index) => (
                <span
                  key={`${height}-${index}`}
                  className="w-2 rounded-full bg-violet-300/80 animate-pulse"
                  style={{
                    height: `${height}px`,
                    animationDelay: `${index * 120}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex w-full items-end justify-between gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-md">
              <div className="mt-2 flex items-center gap-3">
                <img
                  src={authUser?.profilePic || assets.avatar_icon}
                  alt={authUser?.fullName || "You"}
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-medium text-white">
                    {authUser?.fullName || "You"}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-emerald-300">
                    <Mic size={12} /> microphone active
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={endCall}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/40 transition hover:scale-105 hover:bg-red-700"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative bg-black rounded-xl overflow-hidden">
      {/* Remote Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover bg-slate-900"
      />

      <div className="absolute left-4 top-4 rounded-full bg-black/40 px-3 py-1 text-xs text-white backdrop-blur-sm">
        {selectedUser?.fullName || "Remote user"}
      </div>

      {/* Local Video */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute bottom-20 right-4 z-10 h-[120px] w-[160px] rounded-lg border border-white bg-slate-800 object-cover shadow-lg"
      />

      <div className="absolute bottom-[150px] right-4 z-10 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white backdrop-blur-sm">
        You
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-full backdrop-blur-md">
          <button
            onClick={endCall}
            className="w-14 h-14 flex items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default InlineCallUI;
