import React, { useContext } from "react";
import { CallContext } from "../../../context/CallContext";

const CallModal = () => {
  const { callAccepted, localVideoRef, remoteVideoRef, endCall } =
    useContext(CallContext);

  if (!callAccepted) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Remote Video */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      {/* Local Video */}
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="absolute bottom-6 right-6 w-[160px] h-[120px] rounded-lg border border-white"
      />

      {/* End Call Button */}
      <button
        onClick={endCall}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-600 px-6 py-3 rounded-full text-white text-lg hover:bg-red-700"
      >
        End Call
      </button>
    </div>
  );
};

export default CallModal;
