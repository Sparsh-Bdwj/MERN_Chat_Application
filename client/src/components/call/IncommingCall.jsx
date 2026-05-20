import { useContext } from "react";
import { CallContext } from "../../../context/CallContext";
import { ChatContext } from "../../../context/ChatContext";

const IncomingCall = () => {
  const { incomingCall, acceptCall, endCall } = useContext(CallContext);
  const { users } = useContext(ChatContext);

  if (!incomingCall) return null;

  const caller = users.find((user) => user._id === incomingCall.from);
  const callerName = caller?.fullName || "Unknown user";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1b3a] p-6 rounded-xl shadow-xl border border-white/10 w-[320px] text-center">
        <h2 className="text-xl text-white font-semibold mb-2">
          📞 Incoming Call
        </h2>

        <p className="text-gray-200 mb-1 font-medium">{callerName}</p>
        <p className="text-xs text-gray-400 mb-4">{incomingCall.from}</p>

        <p className="text-sm text-gray-400 mb-6">
          {incomingCall.callType === "video"
            ? "🎥 Video Call"
            : "📞 Audio Call"}
        </p>

        <div className="flex justify-center gap-4">
          <button
            onClick={acceptCall}
            className="bg-green-500 px-4 py-2 rounded-full text-white hover:bg-green-600"
          >
            Accept
          </button>

          <button
            onClick={endCall}
            className="bg-red-500 px-4 py-2 rounded-full text-white hover:bg-red-600"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCall;
