import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { AuthContext } from "./AuthContext";
import { CallContext } from "./CallContext";

export const CallProvider = ({ children }) => {
  const { socket } = useContext(AuthContext);

  /* ============================= */
  /* 🎥 CALL STATES */
  /* ============================= */

  const [incomingCall, setIncomingCall] = useState(null);
  const [callUserId, setCallUserId] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callType, setCallType] = useState("video");
  const inCall = callAccepted;

  /* ============================= */
  /* 🎥 MEDIA REFERENCES */
  /* ============================= */

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  const peerConnection = useRef(null);
  const localStream = useRef(null);
  const remoteStream = useRef(null);

  const attachLocalStream = useCallback(() => {
    if (localVideoRef.current && localStream.current) {
      if (localVideoRef.current.srcObject !== localStream.current) {
        localVideoRef.current.srcObject = localStream.current;
      }
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }
  }, []);

  const attachRemoteStream = useCallback(() => {
    if (remoteVideoRef.current && remoteStream.current) {
      if (remoteVideoRef.current.srcObject !== remoteStream.current) {
        remoteVideoRef.current.srcObject = remoteStream.current;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, []);

  /* ============================= */
  /* 🎥 RTC CONFIG */
  /* ============================= */

  const rtcConfig = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  };

  /* ============================= */
  /* 📞 START CALL */
  /* ============================= */

  const startCall = async (userId, type = "video") => {
    try {
      setCallUserId(userId);
      setCallType(type);

      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true,
      });

      attachLocalStream();

      peerConnection.current = new RTCPeerConnection(rtcConfig);

      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });

      peerConnection.current.ontrack = (event) => {
        remoteStream.current = event.streams[0];
        attachRemoteStream();
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", {
            to: userId,
            candidate: event.candidate,
          });
        }
      };

      const offer = await peerConnection.current.createOffer();

      await peerConnection.current.setLocalDescription(offer);

      socket.emit("callUser", {
        to: userId,
        offer,
        callType: type,
      });
    } catch (error) {
      console.error(error);
    }
  };

  /* ============================= */
  /* 📞 ACCEPT CALL */
  /* ============================= */

  const acceptCall = async () => {
    try {
      const activeCallType = incomingCall?.callType || "video";

      setCallAccepted(true);
      setCallType(activeCallType);
      setIncomingCall(null);

      localStream.current = await navigator.mediaDevices.getUserMedia({
        video: activeCallType === "video",
        audio: true,
      });

      attachLocalStream();

      peerConnection.current = new RTCPeerConnection(rtcConfig);

      localStream.current.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, localStream.current);
      });

      peerConnection.current.ontrack = (event) => {
        remoteStream.current = event.streams[0];
        attachRemoteStream();
      };

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", {
            to: incomingCall.from,
            candidate: event.candidate,
          });
        }
      };

      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer),
      );

      const answer = await peerConnection.current.createAnswer();

      await peerConnection.current.setLocalDescription(answer);

      socket.emit("acceptCall", {
        to: incomingCall.from,
        answer,
      });
    } catch (error) {
      console.error(error);
    }
  };

  /* ============================= */
  /* 📞 END CALL */
  /* ============================= */

  const endCall = useCallback(() => {
    if (socket && callUserId) {
      socket.emit("endCall", {
        to: callUserId,
      });
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    remoteStream.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setCallAccepted(false);
    setIncomingCall(null);
    setCallUserId(null);
    setCallType("video");
  }, [socket, callUserId]);

  /* ============================= */
  /* 🎥 ATTACH STREAMS AFTER UI MOUNTS */
  /* ============================= */

  useEffect(() => {
    attachLocalStream();
    attachRemoteStream();
  }, [callAccepted, incomingCall, attachLocalStream, attachRemoteStream]);

  /* ============================= */
  /* 📡 SOCKET LISTENERS */
  /* ============================= */

  useEffect(() => {
    if (!socket) return;

    socket.on("incomingCall", (data) => {
      setIncomingCall(data);
      setCallUserId(data.from);
      setCallType(data.callType || "video");
    });

    socket.on("callAccepted", async (data) => {
      setCallAccepted(true);
      setIncomingCall(null);
      await peerConnection.current.setRemoteDescription(
        new RTCSessionDescription(data.answer),
      );
    });

    socket.on("iceCandidate", async (data) => {
      if (peerConnection.current) {
        await peerConnection.current.addIceCandidate(
          new RTCIceCandidate(data.candidate),
        );
      }
    });

    socket.on("callEnded", () => {
      endCall();
    });

    socket.on("callRejected", () => {
      alert("Call Rejected");
    });

    return () => {
      socket.off("incomingCall");
      socket.off("callAccepted");
      socket.off("iceCandidate");
      socket.off("callEnded");
      socket.off("callRejected");
    };
  }, [socket, endCall]);

  return (
    <CallContext.Provider
      value={{
        inCall,
        callType,
        startCall,
        acceptCall,
        endCall,
        incomingCall,
        callAccepted,
        localVideoRef,
        remoteVideoRef,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
