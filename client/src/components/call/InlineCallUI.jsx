import React, { useContext } from "react";
import { CallContext } from "../../../context/callContext.js";
import { PhoneOff } from "lucide-react";

const InlineCallUI = () => {
  const { localVideoRef, remoteVideoRef, endCall } = useContext(CallContext);

  return (
    <div className="flex-1 relative bg-black rounded-xl overflow-hidden">
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
        className="absolute bottom-20 right-4 w-[160px] h-[120px] rounded-lg border border-white"
      />

      {/* Controls */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-full backdrop-blur-md">
          {/* End */}
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
