import { motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

// icons
import { IoMic as MicOnIcon, IoMicOff as MicOffIcon, IoHandRightSharp as HandIcon } from "react-icons/io5";
import { BsPin as PinIcon } from "react-icons/bs";
import { BsPinFill as PinActiveIcon } from "react-icons/bs";

const MeetGridCard = ({ user, peer }) => {
  const [pin, setPin] = useState(false);
  const videoRef = useRef();
  const [videoActive, setVideoActive] = useState(false);
  const [audioActive, setAudioActive] = useState(true);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  useEffect(() => {
    if (!peer) return;
    
    const handleTrack = (event) => {
      console.log(`Received track from ${user?.displayName}:`, event.track.kind);
      
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    const handleStream = (stream) => {
      console.log(`Received stream from ${user?.displayName}`);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Check video track status
      const videoTrack = stream.getTracks().find(track => track.kind === 'video');
      if (videoTrack) {
        setHasVideoTrack(true);
        setVideoActive(videoTrack.enabled);
        videoTrack.onmute = () => setVideoActive(false);
        videoTrack.onunmute = () => setVideoActive(true);
      } else {
        setHasVideoTrack(false);
        setVideoActive(false);
      }

      // Check audio track status
      const audioTrack = stream.getTracks().find(track => track.kind === 'audio');
      if (audioTrack) {
        setAudioActive(audioTrack.enabled);
        audioTrack.onmute = () => setAudioActive(false);
        audioTrack.onunmute = () => setAudioActive(true);
      }
    };

    const handleConnectionStateChange = () => {
      console.log(`Peer ${user?.displayName} connection state:`, peer.connectionState);
      
      if (peer.connectionState === 'connected') {
        console.log(`✅ Peer ${user?.displayName} connected successfully`);
      } else if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        console.log(`❌ Peer ${user?.displayName} connection failed or disconnected`);
      }
    };

    // Listen for tracks
    peer.ontrack = handleTrack;
    
    // Listen for stream (fallback for older browsers)
    peer.onstream = handleStream;
    
    // Monitor connection state
    peer.onconnectionstatechange = handleConnectionStateChange;

    // Cleanup
    return () => {
      peer.ontrack = null;
      peer.onstream = null;
      peer.onconnectionstatechange = null;
    };
  }, [peer, user]);

  return (
    <motion.div
      layout
      className={`relative bg-slate-900 rounded-3xl overflow-hidden border border-white/5 shadow-2xl ${
        pin && "md:col-span-2 md:row-span-2 md:col-start-1 md:row-start-1"
      }`}
    >
      {/* Pin Button */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        <button
          className={`${
            pin
              ? "bg-yellow border-transparent"
              : "bg-slate-800/70 backdrop-blur border-white/10"
          } border-2 aspect-square p-2.5 cursor-pointer rounded-xl text-white text-xl hover:scale-105 transition-all`}
          onClick={() => {
            setPin(!pin);
          }}
        >
          {pin ? <PinActiveIcon /> : <PinIcon />}
        </button>

        {user?.isHandRaised && (
          <div className="bg-yellow text-white p-2.5 rounded-xl shadow-lg animate-bounce">
            <HandIcon size={20} />
          </div>
        )}
      </div>

      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`h-full w-full object-cover ${!videoActive || !hasVideoTrack ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Avatar when video is off or no video track */}
      {(!videoActive || !hasVideoTrack) && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-4xl font-bold text-white uppercase">
            {user?.displayName?.[0] || user?.name?.[0] || '?'}
          </div>
        </div>
      )}

      {/* User Info */}
      <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2">
        <span className="text-xs font-bold text-white">
          {user?.displayName || user?.name || "Anonymous"}
        </span>
        {!audioActive && <MicOffIcon className="text-red-500 text-xs" />}
      </div>

      {/* Connection Status Indicator */}
      {peer && peer.connectionState === 'connecting' && (
        <div className="absolute top-4 left-4 px-2 py-1 rounded-lg bg-yellow/20 border border-yellow/50 text-yellow text-xs font-bold">
          Connecting...
        </div>
      )}
    </motion.div>
  );
};

export default MeetGridCard;
