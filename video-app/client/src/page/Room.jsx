import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { 
  IoChatboxOutline as ChatIcon, 
  IoVideocamSharp as VideoOnIcon, 
  IoVideocamOff as VideoOffIcon,
  IoMic as MicOnIcon,
  IoMicOff as MicOffIcon,
  IoPersonOutline as UsersIcon,
  IoDesktopOutline as ScreenShareIcon,
  IoSparklesOutline as EffectsIcon,
  IoHandRightSharp as HandIcon,
  IoCreateOutline as WhiteboardIcon,
  IoStatsChartOutline as PollIcon,
  IoAttachOutline as AttachIcon,
  IoDownloadOutline as DownloadIcon,
  IoDocumentOutline as FileIcon
} from "react-icons/io5";
import { MdCallEnd as CallEndIcon, MdOutlineContentCopy as CopyIcon } from "react-icons/md";
import { AiOutlineLink as LinkIcon } from "react-icons/ai";
import { FiSend as SendIcon } from "react-icons/fi";
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import MeetGridCard from "../components/MeetGridCard";
import Loading from "../components/Loading";

// importing audios
import joinSFX from "../sounds/join.mp3";
import msgSFX from "../sounds/message.mp3";
import leaveSFX from "../sounds/leave.mp3";
import notifySFX from "../sounds/notification.mp3";

const Room = () => {
  const { roomID } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [peers, setPeers] = useState([]);
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [sidePanelTab, setSidePanelTab] = useState("chat");
  const [msgs, setMsgs] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [polls, setPolls] = useState([]);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [error, setError] = useState(null);
  
  const socket = useRef();
  const peersRef = useRef([]);
  const localVideo = useRef();
  const localStream = useRef();
  const screenStream = useRef();
  const processedStream = useRef();
  const canvasRef = useRef(document.createElement("canvas"));
  const whiteboardCanvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const selfieSegmentation = useRef(null);
  const chatScroll = useRef();

  // Resize whiteboard canvas when shown
  useEffect(() => {
    if (showWhiteboard && whiteboardCanvasRef.current) {
      const canvas = whiteboardCanvasRef.current;
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
    }
  }, [showWhiteboard]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatScroll.current) {
      chatScroll.current.scrollTop = chatScroll.current.scrollHeight;
    }
  }, [msgs]);

  // Set local video stream when loading completes
  useEffect(() => {
    if (!loading && localVideo.current) {
      if (processedStream.current) {
        localVideo.current.srcObject = processedStream.current;
      } else if (localStream.current) {
        localVideo.current.srcObject = localStream.current;
      }
    }
  }, [loading]);

  // Handle stream replacement for all peers
  const replaceStreamInPeers = useCallback((newStream) => {
    const videoTrack = newStream.getVideoTracks()[0];
    peersRef.current.forEach(peerObj => {
      const sender = peerObj.peer.getSenders().find(s => s.track?.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    });
  }, []);

  // Screen Sharing Toggle
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStream.current = stream;
        setIsScreenSharing(true);
        
        // Handle when user stops sharing via browser UI
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };

        replaceStreamInPeers(stream);
        if (localVideo.current) localVideo.current.srcObject = stream;
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.error("Error screen sharing:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream.current) {
      screenStream.current.getTracks().forEach(track => track.stop());
      screenStream.current = null;
    }
    setIsScreenSharing(false);
    
    const originalStream = processedStream.current || localStream.current;
    replaceStreamInPeers(originalStream);
    if (localVideo.current) localVideo.current.srcObject = originalStream;
  };

  // Background Blur Implementation
  const initSegmentation = useCallback(() => {
    if (selfieSegmentation.current) return;

    const segmentation = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });

    segmentation.setOptions({
      modelSelection: 1,
    });

    segmentation.onResults((results) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      canvas.width = results.image.width;
      canvas.height = results.image.height;

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);

      // Only draw person
      ctx.globalCompositeOperation = "source-in";
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

      // Draw background
      ctx.globalCompositeOperation = "destination-over";
      ctx.filter = "blur(15px)";
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    });

    selfieSegmentation.current = segmentation;
  }, []);

  const toggleBlur = async () => {
    if (!localStream.current) return;

    if (!isBlurred) {
      initSegmentation();
      setIsBlurred(true);

      const videoElement = document.createElement("video");
      videoElement.srcObject = localStream.current;
      await videoElement.play();

      const processVideo = async () => {
        if (selfieSegmentation.current && videoElement.readyState === 4) {
          await selfieSegmentation.current.send({ image: videoElement });
        }
        if (processedStream.current) {
          requestAnimationFrame(processVideo);
        }
      };

      const canvas = canvasRef.current;
      const stream = canvas.captureStream(30);
      processedStream.current = stream;

      // Maintain original audio
      localStream.current.getAudioTracks().forEach(track => stream.addTrack(track));

      if (!isScreenSharing) {
        replaceStreamInPeers(stream);
        if (localVideo.current) localVideo.current.srcObject = stream;
      }
      
      processVideo();
    } else {
      setIsBlurred(false);
      processedStream.current = null;
      
      if (!isScreenSharing) {
        replaceStreamInPeers(localStream.current);
        if (localVideo.current) localVideo.current.srcObject = localStream.current;
      }
    }
  };

  const toggleHandRaise = () => {
    const newHandRaised = !isHandRaised;
    setIsHandRaised(newHandRaised);
    if (socket.current) {
      socket.current.emit('raise-hand', {
        roomId: roomID,
        raised: newHandRaised
      });
    }
  };

  const startDrawing = (e) => {
    isDrawing.current = true;
    const { offsetX, offsetY } = e.nativeEvent;
    lastPos.current = { x: offsetX, y: offsetY };
  };

  const draw = (e) => {
    if (!isDrawing.current || !whiteboardCanvasRef.current) return;
    
    const { offsetX, offsetY } = e.nativeEvent;
    const ctx = whiteboardCanvasRef.current.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(offsetX, offsetY);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    if (socket.current) {
      socket.current.emit('draw', {
        roomId: roomID,
        data: {
          x0: lastPos.current.x,
          y0: lastPos.current.y,
          x1: offsetX,
          y1: offsetY,
          color: '#FFFFFF',
          size: 2
        }
      });
    }

    lastPos.current = { x: offsetX, y: offsetY };
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearWhiteboard = () => {
    if (!whiteboardCanvasRef.current) return;
    const ctx = whiteboardCanvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, whiteboardCanvasRef.current.width, whiteboardCanvasRef.current.height);
    if (socket.current) {
      socket.current.emit('clear-whiteboard', { roomId: roomID });
    }
  };

  const createPoll = (e) => {
    e.preventDefault();
    if (!pollQuestion.trim() || pollOptions.some(opt => !opt.trim())) return;

    const newPoll = {
      id: Date.now().toString(),
      question: pollQuestion,
      options: pollOptions.map(opt => ({ text: opt, votes: [] })),
      creator: user.displayName,
      active: true
    };

    if (socket.current) {
      socket.current.emit('create-poll', { roomId: roomID, poll: newPoll });
    }
    setPollQuestion("");
    setPollOptions(["", ""]);
    setShowPollCreator(false);
    setSidePanelTab("polls");
  };

  const votePoll = (pollId, optionIndex) => {
    if (socket.current) {
      socket.current.emit('vote-poll', { 
        roomId: roomID, 
        pollId, 
        optionIndex, 
        userId: user.uid 
      });
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomID);
    formData.append('userId', user.uid);
    formData.append('userName', user.displayName);

    try {
      const response = await fetch(`${process.env.REACT_APP_SOCKET_BACKEND_URL || "http://localhost:4000"}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        // Emit socket event for others to see the file
        if (socket.current) {
          socket.current.emit('send-message', {
            roomId: roomID,
            message: data.text,
            user: { uid: user.uid, displayName: user.displayName },
            fileData: {
              fileUrl: data.fileUrl,
              fileName: data.fileName,
              fileType: data.fileType
            }
          });
        }
      }
    } catch (err) {
      console.error('Error uploading file:', err);
    }
  };

  // Create peer connection
  const createPeer = useCallback((userId, stream) => {
    console.log(`Creating peer connection to ${userId}`);
    
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    });

    // Add local stream tracks to peer connection
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && socket.current) {
        socket.current.emit('ice-candidate', {
          to: userId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    peer.onconnectionstatechange = () => {
      console.log(`Peer ${userId} connection state: ${peer.connectionState}`);
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
        console.log(`Peer ${userId} connection failed or disconnected`);
      }
    };
    
    // Handle track events
    peer.ontrack = (event) => {
      console.log(`📥 Received track from ${userId}:`, event.track.kind);
      if (event.streams && event.streams[0]) {
        console.log(`📥 Received stream from ${userId}:`, event.streams[0].id);
      }
    };

    return peer;
  }, []);

  // Add peer for incoming connection
  const addPeer = useCallback((incomingSignal, callerID, stream) => {
    console.log(`Adding peer from ${callerID}`);
    
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ]
    });

    // Add local stream tracks to peer connection
    stream.getTracks().forEach(track => {
      peer.addTrack(track, stream);
    });

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && socket.current) {
        socket.current.emit('ice-candidate', {
          to: callerID,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    peer.onconnectionstatechange = () => {
      console.log(`Peer ${callerID} connection state: ${peer.connectionState}`);
    };
    
    // Handle track events
    peer.ontrack = (event) => {
      console.log(`📥 Received track from ${callerID}:`, event.track.kind);
      if (event.streams && event.streams[0]) {
        console.log(`📥 Received stream from ${callerID}:`, event.streams[0].id);
      }
    };

    // Set remote description and create answer
    peer.setRemoteDescription(new RTCSessionDescription(incomingSignal))
      .then(() => peer.createAnswer())
      .then(answer => peer.setLocalDescription(answer))
      .then(() => {
        if (socket.current) {
          socket.current.emit('answer', {
            to: callerID,
            answer: peer.localDescription
          });
        }
      })
      .catch(err => console.error('Error creating answer:', err));

    return peer;
  }, []);

  const setupSocketListeners = useCallback((socketInstance) => {
    // Handle existing users in room
    socketInstance.on('room-users', (users) => {
      console.log(`👥 Users in room: ${users.length}`);
      
      const peers = [];
      const stream = localStream.current;
      users.forEach(({ userId, user: userData }) => {
        console.log(`Creating peer for existing user: ${userData.displayName}`);
        const peer = createPeer(userId, stream);
        
        // Create and send offer
        peer.createOffer()
          .then(offer => peer.setLocalDescription(offer))
          .then(() => {
            socketInstance.emit('offer', {
              to: userId,
              offer: peer.localDescription,
              from: {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL
              }
            });
          })
          .catch(err => console.error('Error creating offer:', err));

        const peerObj = {
          peerID: userId,
          peer,
          user: userData
        };
        
        peersRef.current.push(peerObj);
        peers.push(peerObj);
      });
      
      setPeers(peers);
      setLoading(false);
    });

    // Handle new user joining
    socketInstance.on('user-joined', ({ userId, user: userData }) => {
      console.log(`👤 New user joined: ${userData.displayName}`);
      new Audio(joinSFX).play();
      
      const peer = addPeer(null, userId, localStream.current);
      const peerObj = {
        peerID: userId,
        peer,
        user: userData
      };
      
      peersRef.current.push(peerObj);
      setPeers(prev => [...prev, peerObj]);
    });

    // Handle incoming offer
    socketInstance.on('offer', ({ from, offer, user: userData }) => {
      console.log(`📥 Received offer from: ${userData.displayName}`);
      
      const peer = addPeer(offer, from, localStream.current);
      const peerObj = {
        peerID: from,
        peer,
        user: userData
      };
      
      peersRef.current.push(peerObj);
      setPeers(prev => [...prev, peerObj]);
    });

    // Handle incoming answer
    socketInstance.on('answer', ({ from, answer }) => {
      console.log(`📥 Received answer from: ${from}`);
      
      const peerObj = peersRef.current.find(p => p.peerID === from);
      if (peerObj) {
        peerObj.peer.setRemoteDescription(new RTCSessionDescription(answer))
          .catch(err => console.error('Error setting remote description:', err));
      }
    });

    // Handle ICE candidates
    socketInstance.on('ice-candidate', ({ from, candidate }) => {
      const peerObj = peersRef.current.find(p => p.peerID === from);
      if (peerObj && candidate) {
        peerObj.peer.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(err => console.error('Error adding ICE candidate:', err));
      }
    });

    // Handle user leaving
    socketInstance.on('user-left', ({ userId, user: userData }) => {
      console.log(`👤 User left: ${userData?.displayName || userId}`);
      new Audio(leaveSFX).play();
      
      const peerObj = peersRef.current.find(p => p.peerID === userId);
      if (peerObj) {
        peerObj.peer.close();
      }
      
      peersRef.current = peersRef.current.filter(p => p.peerID !== userId);
      setPeers(prev => prev.filter(p => p.peerID !== userId));
    });

    // Handle chat messages
    socketInstance.on('receive-message', (data) => {
      if (data.user.uid !== user.uid) {
        new Audio(msgSFX).play();
      }
      setMsgs(prev => [...prev, { 
        ...data, 
        send: data.user.uid === user.uid 
      }]);
    });

    // Handle chat history from MySQL
    socketInstance.on('chat-history', (history) => {
      const formattedHistory = history.map(m => ({
        user: { uid: m.userId, displayName: m.userName },
        message: m.text,
        timestamp: m.timestamp,
        send: m.userId === user.uid,
        fileData: m.fileUrl ? {
          fileUrl: m.fileUrl,
          fileName: m.fileName,
          fileType: m.fileType
        } : null
      }));
      setMsgs(formattedHistory);
    });

    // Handle media toggle
    socketInstance.on('user-toggle-media', ({ userId, type, enabled }) => {
      setPeers(prev => prev.map(p => {
        if (p.peerID === userId) {
          return { ...p, [type === 'audio' ? 'micOn' : 'videoOn']: enabled };
        }
        return p;
      }));
    });

    // Handle hand raising
    socketInstance.on('user-raised-hand', ({ userId, raised }) => {
      if (raised) {
        new Audio(notifySFX).play();
      }
      setPeers(prev => prev.map(p => {
        if (p.peerID === userId) {
          return { ...p, isHandRaised: raised };
        }
        return p;
      }));
    });

    // Handle whiteboard drawing
    socketInstance.on('draw', (data) => {
      if (!whiteboardCanvasRef.current) return;
      const ctx = whiteboardCanvasRef.current.getContext('2d');
      const { x0, y0, x1, y1, color, size } = data;
      
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.stroke();
    });

    socketInstance.on('clear-whiteboard', () => {
      if (!whiteboardCanvasRef.current) return;
      const ctx = whiteboardCanvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, whiteboardCanvasRef.current.width, whiteboardCanvasRef.current.height);
    });

    // Handle polls
    socketInstance.on('poll-created', (poll) => {
      setPolls(prev => [poll, ...prev]);
      if (sidePanelTab !== 'polls') {
        new Audio(notifySFX).play();
      }
    });

    socketInstance.on('poll-updated', (updatedPoll) => {
      setPolls(prev => prev.map(p => p.id === updatedPoll.id ? updatedPoll : p));
    });
  }, [user, createPeer, addPeer, sidePanelTab]);

  // Initialize room and socket connection
  useEffect(() => {
    const init = async () => {
      try {
        // Check if backend is reachable
        const socketUrl = process.env.REACT_APP_SOCKET_BACKEND_URL || "http://localhost:4000";
        console.log(`🔌 Checking backend at: ${socketUrl}`);
        
        try {
          const healthCheck = await fetch(`${socketUrl}/health`);
          if (!healthCheck.ok) {
            throw new Error('Backend server is not responding');
          }
          console.log('✅ Backend is reachable');
        } catch (fetchErr) {
          console.error('❌ Backend health check failed:', fetchErr);
          setError(`Cannot connect to backend server at ${socketUrl}. Please ensure the backend is running.`);
          setLoading(false);
          return;
        }

        console.log("🎥 Requesting camera and microphone access...");
        
        let stream;
        try {
          // Try with ideal constraints first
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        } catch (constraintErr) {
          console.log('⚠️ Failed with ideal constraints, trying basic constraints...');
          // Fallback to basic constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
          });
        }
        
        console.log("✅ Stream acquired successfully:", stream.id);
        localStream.current = stream;
        
        if (localVideo.current) {
          localVideo.current.srcObject = stream;
        }
        console.log(`🔌 Connecting to socket server: ${socketUrl}`);
        
        socket.current = io(socketUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        socket.current.on('connect', () => {
          console.log('✅ Socket connected:', socket.current.id);
          
          // Join room
          socket.current.emit('join-room', {
            roomId: roomID,
            user: {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              photoURL: user.photoURL
            }
          });
        });

        socket.current.on('connect_error', (err) => {
          console.error('❌ Socket connection error:', err);
          setError(`Failed to connect to server: ${err.message}. Please check if backend is running on port 4000.`);
        });

        // Setup all socket listeners
        setupSocketListeners(socket.current);

      } catch (err) {
        console.error("❌ Failed to get local stream!", err);
        
        // If device is in use, try to join without camera/microphone
        if (err.name === 'NotReadableError') {
          console.log('⚠️ Device in use, joining without camera/microphone...');
          
          // Create empty stream with a silent audio track for WebRTC to work
          const emptyStream = new MediaStream();
          
          // Add a silent audio track so peer connection can be established
          try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0; // Silent
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            const silentStream = audioContext.createMediaStreamDestination();
            gainNode.connect(silentStream);
            
            // Add the silent track to our empty stream
            silentStream.stream.getAudioTracks().forEach(track => {
              emptyStream.addTrack(track);
            });
          } catch (audioErr) {
            console.log('⚠️ Could not create silent audio track, using empty stream');
          }
          
          localStream.current = emptyStream;
          
          if (localVideo.current) {
            localVideo.current.srcObject = emptyStream;
          }
          
          // Connect to socket server
          const socketUrl = process.env.REACT_APP_SOCKET_BACKEND_URL || "http://localhost:4000";
          console.log(`🔌 Connecting to socket server: ${socketUrl}`);
          
          socket.current = io(socketUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
          });

          socket.current.on('connect', () => {
            console.log('✅ Socket connected:', socket.current.id);
            
            // Join room
            socket.current.emit('join-room', {
              roomId: roomID,
              user: {
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL
              }
            });
          });

          socket.current.on('connect_error', (err) => {
            console.error('❌ Socket connection error:', err);
            setError(`Failed to connect to server: ${err.message}. Please check if backend is running on port 4000.`);
          });

          // Setup all socket listeners
          setupSocketListeners(socket.current);
          
          return;
        }
        
        let errorMessage = "Failed to access camera/microphone. ";
        if (err.name === 'NotAllowedError') {
          errorMessage += "Please allow camera and microphone permissions in your browser settings.";
        } else if (err.name === 'NotFoundError') {
          errorMessage += "No camera or microphone found.";
        } else {
          errorMessage += err.message;
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    };

    if (user) {
      console.log('👤 User authenticated:', user.displayName, user.uid);
      init();
    } else {
      console.log('⚠️ No user found, waiting for auth...');
      // Wait a bit for auth to load, then show error if still no user
      const authTimeout = setTimeout(() => {
        if (!user) {
          console.error('❌ User still not authenticated after timeout');
          setError('Authentication required. Please log in first.');
          setLoading(false);
        }
      }, 3000);
      return () => clearTimeout(authTimeout);
    }

    // Fallback timeout to ensure loading completes
    const loadingTimeout = setTimeout(() => {
      console.log('⏰ Loading timeout - forcing loading to complete');
      setLoading(false);
    }, 8000);

    return () => {
      clearTimeout(loadingTimeout);
      if (localStream.current) {
        localStream.current.getTracks().forEach(track => track.stop());
      }
      if (socket.current) {
        socket.current.emit('leave-room', { roomId: roomID });
        socket.current.disconnect();
      }
      peersRef.current.forEach(p => p.peer.close());
    };
  }, [roomID, user, createPeer, addPeer, setupSocketListeners]);

  const toggleMic = () => {
    const newMicOn = !micOn;
    setMicOn(newMicOn);
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(track => {
        track.enabled = newMicOn;
      });
    }
    if (socket.current) {
      socket.current.emit('toggle-media', {
        roomId: roomID,
        type: 'audio',
        enabled: newMicOn
      });
    }
  };

  const toggleVideo = () => {
    const newVideoOn = !videoOn;
    setVideoOn(newVideoOn);
    if (localStream.current) {
      localStream.current.getVideoTracks().forEach(track => {
        track.enabled = newVideoOn;
      });
    }
    if (socket.current) {
      socket.current.emit('toggle-media', {
        roomId: roomID,
        type: 'video',
        enabled: newVideoOn
      });
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (msgText.trim() && socket.current) {
      socket.current.emit('send-message', {
        roomId: roomID,
        message: msgText.trim(),
        user: {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        }
      });
      setMsgText("");
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomID);
    alert("Room ID copied to clipboard!");
  };

  // Show loading while auth is being checked
  if (!user) {
    return <Loading />;
  }

  if (loading) return <Loading />;

  if (error) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="bg-red-500/20 border border-red-500/50 rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-yellow text-white rounded-xl hover:bg-yellow/90 transition-all font-bold"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/")}
              className="w-full px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-all"
            >
              Go Back Home
            </button>
          </div>
          <p className="text-slate-500 text-xs mt-4">
            Check browser console (F12) for detailed error logs
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden text-slate-200">
      
      {/* Main Content Area */}
      <div className="flex-grow flex relative overflow-hidden">
        
        {/* Video Grid */}
        <div className={`flex-grow p-6 transition-all duration-500 ${showSidePanel ? 'mr-96' : ''}`}>
          
          {/* Whiteboard Overlay */}
          <AnimatePresence>
            {showWhiteboard && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-6 z-40 bg-slate-900/90 backdrop-blur-md rounded-[2.5rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow/20 rounded-2xl text-yellow">
                      <WhiteboardIcon size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Collaborative Whiteboard</h3>
                      <p className="text-xs text-slate-500">Draw and brainstorm with everyone in real-time</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={clearWhiteboard}
                      className="px-6 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all font-bold text-sm"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={() => setShowWhiteboard(false)}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                    >
                      <CallEndIcon size={20} className="rotate-45" />
                    </button>
                  </div>
                </div>
                
                <div className="flex-grow relative cursor-crosshair touch-none">
                  <canvas
                    ref={whiteboardCanvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
            {/* Local Video */}
            <motion.div 
              layout
              className="relative rounded-3xl overflow-hidden bg-slate-900 border border-white/5 shadow-2xl group"
            >
              <video
                muted
                ref={localVideo}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${!videoOn ? 'opacity-0' : 'opacity-100'}`}
              />
              {!videoOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                  <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-4xl font-bold text-white uppercase">
                    {user?.displayName?.[0]}
                  </div>
                </div>
              )}
              {isHandRaised && (
                <div className="absolute top-4 right-4 bg-yellow text-white p-2 rounded-full shadow-lg animate-bounce">
                  <HandIcon size={20} />
                </div>
              )}
              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2">
                <span className="text-xs font-bold">{user?.displayName} (You)</span>
                {!micOn && <MicOffIcon className="text-red-500 text-xs" />}
              </div>
            </motion.div>

            {/* Remote Peers */}
            {peers.map((peerObj) => (
              <MeetGridCard 
                key={peerObj.peerID} 
                peer={peerObj.peer} 
                user={peerObj.user}
              />
            ))}
          </div>
        </div>

        {/* Side Panel (Chat/Participants) */}
        <AnimatePresence>
          {showSidePanel && (
            <motion.div 
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              className="absolute right-0 top-0 bottom-0 w-96 bg-slate-900/80 backdrop-blur-2xl border-l border-white/10 flex flex-col z-40 shadow-2xl"
            >
              {/* Header inside Panel */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">
                  {sidePanelTab === 'chat' ? 'Room Chat' : 'Participants'}
                </h3>
                <button 
                  onClick={() => setShowSidePanel(false)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex p-4 gap-2 bg-slate-950/20">
                <button 
                  onClick={() => setSidePanelTab("chat")}
                  className={`flex-grow py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-widest ${sidePanelTab === 'chat' ? 'bg-yellow text-white shadow-lg shadow-yellow/20' : 'bg-slate-800/50 text-slate-500 hover:text-slate-400'}`}
                >
                  <ChatIcon size={18} /> Chat
                </button>
                <button 
                  onClick={() => setSidePanelTab("participants")}
                  className={`flex-grow py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-widest ${sidePanelTab === 'participants' ? 'bg-yellow text-white shadow-lg shadow-yellow/20' : 'bg-slate-800/50 text-slate-500 hover:text-slate-400'}`}
                >
                  <UsersIcon size={18} /> People ({peers.length + 1})
                </button>
                <button 
                  onClick={() => setSidePanelTab("polls")}
                  className={`flex-grow py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-xs uppercase tracking-widest ${sidePanelTab === 'polls' ? 'bg-yellow text-white shadow-lg shadow-yellow/20' : 'bg-slate-800/50 text-slate-500 hover:text-slate-400'}`}
                >
                  <PollIcon size={18} /> Polls
                </button>
              </div>

              {/* Chat Content */}
              {sidePanelTab === "chat" ? (
                <>
                  <div 
                    ref={chatScroll}
                    className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800"
                  >
                    {msgs.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.send ? 'items-end' : 'items-start'}`}>
                        {!m.send && (
                          <div className="flex items-center gap-2 mb-1.5 ml-1">
                            <span className="text-[10px] font-black text-yellow uppercase tracking-widest">{m.user.displayName}</span>
                            <span className="text-[8px] text-slate-600 font-bold uppercase">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        )}
                        <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${m.send ? 'bg-blue text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-white/5'}`}>
                          {m.fileData ? (
                            <div className="flex flex-col gap-3">
                              {m.fileData.fileType.startsWith('image/') ? (
                                <img 
                                  src={m.fileData.fileUrl} 
                                  alt={m.fileData.fileName}
                                  className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => window.open(m.fileData.fileUrl, '_blank')}
                                />
                              ) : (
                                <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                  <div className="p-2 bg-white/10 rounded-lg text-yellow">
                                    <FileIcon size={20} />
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold truncate">{m.fileData.fileName}</span>
                                    <span className="text-[10px] opacity-50 uppercase">{m.fileData.fileType.split('/')[1] || 'File'}</span>
                                  </div>
                                </div>
                              )}
                              <a 
                                href={m.fileData.fileUrl} 
                                download={m.fileData.fileName}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${m.send ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-yellow text-white hover:bg-yellow/90'}`}
                              >
                                <DownloadIcon size={14} /> Download
                              </a>
                            </div>
                          ) : (
                            m.message
                          )}
                        </div>
                        {m.send && (
                          <span className="text-[8px] text-slate-600 font-bold uppercase mt-1.5 mr-1">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-6 bg-slate-950/30 border-t border-white/5">
                    <form onSubmit={sendMessage} className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-yellow to-yellow/50 rounded-2xl blur opacity-0 group-focus-within:opacity-20 transition duration-500"></div>
                      <div className="relative flex items-center gap-2 bg-slate-900 border border-white/10 rounded-2xl p-2 pl-4 focus-within:border-yellow/50 transition-all">
                        <label className="cursor-pointer p-2 text-slate-500 hover:text-yellow transition-colors">
                          <AttachIcon size={20} />
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={uploadFile}
                          />
                        </label>
                        <input 
                          type="text" 
                          placeholder="Message everyone..."
                          className="flex-grow bg-transparent text-white text-sm outline-none placeholder:text-slate-600 py-2"
                          value={msgText}
                          onChange={(e) => setMsgText(e.target.value)}
                        />
                        <button 
                          type="submit"
                          disabled={!msgText.trim()}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${msgText.trim() ? 'bg-yellow text-white shadow-lg shadow-yellow/20 hover:scale-105 active:scale-95' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                          <SendIcon size={18} />
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : sidePanelTab === "participants" ? (
                <div className="flex-grow overflow-y-auto p-6 space-y-4">
                  {/* Participant List */}
                  <div className="flex items-center gap-4 p-3 rounded-2xl bg-slate-800/40 border border-white/5">
                    <img src={user?.photoURL} className="w-10 h-10 rounded-full border-2 border-yellow" alt="" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{user?.displayName} (Host)</span>
                      <span className="text-[10px] text-slate-500">Local User</span>
                    </div>
                  </div>
                  {peers.map(p => (
                    <div key={p.peerID} className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-white/5">
                      <div className="flex items-center gap-4">
                        <img src={p.user.photoURL} className="w-10 h-10 rounded-full" alt="" />
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{p.user.displayName}</span>
                          <span className="text-[10px] text-slate-500">Participant</span>
                        </div>
                      </div>
                      {p.isHandRaised && (
                        <div className="p-2 bg-yellow text-white rounded-xl shadow-lg animate-bounce">
                          <HandIcon size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : sidePanelTab === "polls" ? (
                <div className="flex-grow overflow-y-auto p-6 space-y-6">
                  {!showPollCreator ? (
                    <>
                      <button 
                        onClick={() => setShowPollCreator(true)}
                        className="w-full py-4 rounded-2xl bg-yellow text-white font-bold shadow-lg shadow-yellow/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        <PollIcon size={20} /> Create New Poll
                      </button>
                      
                      <div className="space-y-4">
                        {polls.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                              <PollIcon size={32} />
                            </div>
                            <p className="text-slate-500 text-sm font-medium">No active polls yet</p>
                          </div>
                        ) : (
                          polls.map(poll => (
                            <div key={poll.id} className="bg-slate-800/40 border border-white/5 rounded-2xl p-5 space-y-4">
                              <div>
                                <h4 className="text-white font-bold text-sm leading-snug">{poll.question}</h4>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Created by {poll.creator}</p>
                              </div>
                              <div className="space-y-2">
                                {poll.options.map((opt, idx) => {
                                  const totalVotes = poll.options.reduce((acc, o) => acc + o.votes.length, 0);
                                  const percentage = totalVotes === 0 ? 0 : Math.round((opt.votes.length / totalVotes) * 100);
                                  const hasVoted = opt.votes.includes(user.uid);
                                  const userVotedInPoll = poll.options.some(o => o.votes.includes(user.uid));

                                  return (
                                    <button
                                      key={idx}
                                      disabled={userVotedInPoll}
                                      onClick={() => votePoll(poll.id, idx)}
                                      className={`w-full relative overflow-hidden rounded-xl border transition-all text-left ${hasVoted ? 'border-yellow/50 bg-yellow/10' : 'border-white/5 bg-slate-900/50 hover:bg-slate-900'}`}
                                    >
                                      <div 
                                        className={`absolute inset-y-0 left-0 transition-all duration-1000 ${hasVoted ? 'bg-yellow/20' : 'bg-white/5'}`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                      <div className="relative px-4 py-3 flex items-center justify-between text-xs">
                                        <span className={`font-bold ${hasVoted ? 'text-yellow' : 'text-slate-300'}`}>{opt.text}</span>
                                        <span className="text-slate-500 font-mono">{percentage}% ({opt.votes.length})</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="bg-slate-800/40 border border-white/5 rounded-2xl p-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-bold">New Poll</h3>
                        <button 
                          onClick={() => setShowPollCreator(false)}
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                      
                      <form onSubmit={createPoll} className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Question</label>
                          <input 
                            type="text" 
                            required
                            placeholder="What would you like to ask?"
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-yellow/50 transition-all"
                            value={pollQuestion}
                            onChange={(e) => setPollQuestion(e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Options</label>
                          {pollOptions.map((opt, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input 
                                type="text" 
                                required
                                placeholder={`Option ${idx + 1}`}
                                className="flex-grow bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-yellow/50 transition-all"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...pollOptions];
                                  newOpts[idx] = e.target.value;
                                  setPollOptions(newOpts);
                                }}
                              />
                              {pollOptions.length > 2 && (
                                <button 
                                  type="button"
                                  onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                                  className="p-3 text-slate-500 hover:text-red-500 transition-colors"
                                >
                                  <CallEndIcon size={18} />
                                </button>
                              )}
                            </div>
                          ))}
                          
                          {pollOptions.length < 5 && (
                            <button 
                              type="button"
                              onClick={() => setPollOptions([...pollOptions, ""])}
                              className="text-yellow text-xs font-bold hover:underline ml-1"
                            >
                              + Add another option
                            </button>
                          )}
                        </div>

                        <button 
                          type="submit"
                          className="w-full py-3.5 rounded-xl bg-yellow text-white font-bold shadow-lg shadow-yellow/20 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                        >
                          Launch Poll
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Controls */}
      <div className="h-28 px-8 flex items-center justify-between bg-slate-900 border-t border-white/5 z-50">
        <div className="hidden md:flex flex-col">
          <h2 className="text-lg font-bold text-white tracking-tight">Meeting Session</h2>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <LinkIcon className="text-yellow" />
            <span>{roomID}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleMic}
            className={`p-4 rounded-2xl transition-all ${micOn ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-red-500 text-white shadow-lg shadow-red-500/20'}`}
            title={micOn ? "Mute Mic" : "Unmute Mic"}
          >
            {micOn ? <MicOnIcon size={24} /> : <MicOffIcon size={24} />}
          </button>
          <button 
            onClick={toggleVideo}
            className={`p-4 rounded-2xl transition-all ${videoOn ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-red-500 text-white shadow-lg shadow-red-500/20'}`}
            title={videoOn ? "Turn Off Video" : "Turn On Video"}
          >
            {videoOn ? <VideoOnIcon size={24} /> : <VideoOffIcon size={24} />}
          </button>

          <button 
            onClick={toggleScreenShare}
            className={`p-4 rounded-2xl transition-all ${!isScreenSharing ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-blue text-white shadow-lg shadow-blue/20'}`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            <ScreenShareIcon size={24} />
          </button>

          <button 
            onClick={toggleBlur}
            className={`p-4 rounded-2xl transition-all ${!isBlurred ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-yellow text-white shadow-lg shadow-yellow/20'}`}
            title={isBlurred ? "Disable Blur" : "Blur Background"}
          >
            <EffectsIcon size={24} />
          </button>

          <button 
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            className={`p-4 rounded-2xl transition-all ${!showWhiteboard ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-yellow text-white shadow-lg shadow-yellow/20'}`}
            title={showWhiteboard ? "Close Whiteboard" : "Open Whiteboard"}
          >
            <WhiteboardIcon size={24} />
          </button>

          <button 
            onClick={toggleHandRaise}
            className={`p-4 rounded-2xl transition-all ${!isHandRaised ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-yellow text-white shadow-lg shadow-yellow/20'}`}
            title={isHandRaised ? "Lower Hand" : "Raise Hand"}
          >
            <HandIcon size={24} />
          </button>
          
          <button 
            onClick={() => setShowShareModal(true)}
            className="p-4 rounded-2xl bg-blue text-white shadow-lg shadow-blue/20 hover:scale-105 active:scale-95 transition-all mx-2"
            title="Invite Others"
          >
            <CopyIcon size={24} />
          </button>

          <button 
            onClick={() => navigate("/")}
            className="px-8 py-4 rounded-2xl bg-red-500 text-white font-bold flex items-center gap-3 shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all"
            title="Leave Call"
          >
            <CallEndIcon size={24} />
            <span className="hidden sm:inline">End Call</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowSidePanel(!showSidePanel)}
            className={`p-4 rounded-2xl transition-all ${showSidePanel ? 'bg-yellow text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
          >
            <ChatIcon size={24} />
          </button>
        </div>
      </div>

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-slate-900 p-8 rounded-[2.5rem] border border-white/10 shadow-2xl w-full max-w-md"
            >
              <h3 className="text-2xl font-bold text-white mb-2">Invite Others</h3>
              <p className="text-slate-400 text-sm mb-6">Share this room ID with participants you want to join.</p>
              
              <div className="bg-slate-800 p-4 rounded-2xl flex items-center justify-between border border-white/5 mb-6">
                <code className="text-yellow font-mono text-lg">{roomID}</code>
                <button 
                  onClick={copyRoomId}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <CopyIcon size={20} />
                </button>
              </div>
              
              <button 
                onClick={() => setShowShareModal(false)}
                className="w-full py-4 rounded-2xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-all"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Room;
