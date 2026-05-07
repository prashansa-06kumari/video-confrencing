require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { connectDB } = require('./config/database');
const User = require('./models/User');
const Room = require('./models/Room');
const Message = require('./models/Message');
const socketIO = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Middleware
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001"],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File Upload Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { roomId, userId, userName } = req.body;
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    const savedMessage = await Message.create({
      roomId,
      userId,
      userName,
      fileUrl,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      text: `Shared a file: ${req.file.originalname}`
    });

    res.json(savedMessage);
  } catch (err) {
    console.error('❌ Error uploading file:', err.message);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// MySQL Connection
connectDB();

// Socket.io setup with CORS
const io = socketIO(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store active rooms and users
const rooms = new Map();
const socketToRoom = new Map();
const roomPolls = new Map(); // Store polls per room

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Join room
  socket.on('join-room', async ({ roomId, user }) => {
    console.log(`👤 User ${user.displayName} (${user.uid}) joining room: ${roomId}`);
    
    try {
      // Persist user to MySQL
      await User.upsert({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      });

      // Persist room to MySQL
      await Room.findOrCreate({
        where: { roomId: roomId },
        defaults: { createdBy: user.uid }
      });

      socket.join(roomId);
      socketToRoom.set(socket.id, roomId);

      // Initialize room in-memory if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }

      const room = rooms.get(roomId);
      
      // Check if user already exists in room (reconnection)
      let existingUserId = null;
      for (const [userId, userData] of room.entries()) {
        if (userData.uid === user.uid) {
          existingUserId = userId;
          break;
        }
      }

      // Remove old socket if user is reconnecting
      if (existingUserId && existingUserId !== socket.id) {
        room.delete(existingUserId);
        console.log(`🔄 User ${user.displayName} reconnected with new socket ID`);
      }

      // Add user to room
      room.set(socket.id, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL
      });

      // Get all other users in the room
      const otherUsers = [];
      for (const [userId, userData] of room.entries()) {
        if (userId !== socket.id) {
          otherUsers.push({
            userId,
            user: userData
          });
        }
      }

      console.log(`📊 Room ${roomId} now has ${room.size} users`);

      // Fetch chat history from MySQL
      const messages = await Message.findAll({
        where: { roomId },
        order: [['timestamp', 'ASC']],
        limit: 50
      });

      // Send list of existing users and chat history to the new user
      socket.emit('room-users', otherUsers);
      socket.emit('chat-history', messages);

      // Send existing polls to the new user
      if (roomPolls.has(roomId)) {
        roomPolls.get(roomId).forEach(poll => {
          socket.emit('poll-created', poll);
        });
      }

      // Notify others that a new user joined
      socket.to(roomId).emit('user-joined', {
        userId: socket.id,
        user: {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL
        }
      });
    } catch (err) {
      console.error('❌ Error in join-room:', err.message);
    }
  });

  // WebRTC signaling - offer
  socket.on('offer', ({ to, offer, from }) => {
    console.log(`📤 Offer from ${socket.id} to ${to}`);
    io.to(to).emit('offer', {
      from: socket.id,
      offer,
      user: from
    });
  });

  // WebRTC signaling - answer
  socket.on('answer', ({ to, answer }) => {
    console.log(`📥 Answer from ${socket.id} to ${to}`);
    io.to(to).emit('answer', {
      from: socket.id,
      answer
    });
  });

  // WebRTC signaling - ICE candidate
  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', {
      from: socket.id,
      candidate
    });
  });

  // Chat message
  socket.on('send-message', async ({ roomId, message, user, fileData }) => {
    try {
      // Persist message to MySQL
      const savedMessage = await Message.create({
        roomId,
        userId: user.uid,
        userName: user.displayName,
        text: message,
        fileUrl: fileData?.fileUrl,
        fileName: fileData?.fileName,
        fileType: fileData?.fileType
      });

      io.to(roomId).emit('receive-message', {
        userId: socket.id,
        user,
        message,
        timestamp: savedMessage.timestamp,
        fileData: fileData || null
      });
    } catch (err) {
      console.error('❌ Error saving message:', err.message);
    }
  });

  // Toggle audio/video
  socket.on('toggle-media', ({ roomId, type, enabled }) => {
    socket.to(roomId).emit('user-toggle-media', {
      userId: socket.id,
      type,
      enabled
    });
  });

  // Hand raising
  socket.on('raise-hand', ({ roomId, raised }) => {
    socket.to(roomId).emit('user-raised-hand', {
      userId: socket.id,
      raised
    });
  });

  // Whiteboard drawing
  socket.on('draw', ({ roomId, data }) => {
    socket.to(roomId).emit('draw', data);
  });

  socket.on('clear-whiteboard', ({ roomId }) => {
    socket.to(roomId).emit('clear-whiteboard');
  });

  // Polls
  socket.on('create-poll', ({ roomId, poll }) => {
    if (!roomPolls.has(roomId)) {
      roomPolls.set(roomId, []);
    }
    roomPolls.get(roomId).push(poll);
    io.to(roomId).emit('poll-created', poll);
  });

  socket.on('vote-poll', ({ roomId, pollId, optionIndex, userId }) => {
    if (roomPolls.has(roomId)) {
      const polls = roomPolls.get(roomId);
      const poll = polls.find(p => p.id === pollId);
      if (poll) {
        // Remove user's previous vote if any
        poll.options.forEach(opt => {
          const index = opt.votes.indexOf(userId);
          if (index > -1) opt.votes.splice(index, 1);
        });
        
        // Add new vote
        poll.options[optionIndex].votes.push(userId);
        io.to(roomId).emit('poll-updated', poll);
      }
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    
    const roomId = socketToRoom.get(socket.id);
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const userData = room.get(socket.id);
      
      room.delete(socket.id);
      
      // Notify others
      socket.to(roomId).emit('user-left', {
        userId: socket.id,
        user: userData
      });

      console.log(`👤 User left room ${roomId}. Remaining users: ${room.size}`);

      // Clean up empty rooms
      if (room.size === 0) {
        rooms.delete(roomId);
        console.log(`🗑️ Room ${roomId} deleted (empty)`);
      }
    }

    socketToRoom.delete(socket.id);
  });

  // Leave room explicitly
  socket.on('leave-room', ({ roomId }) => {
    console.log(`👤 User ${socket.id} leaving room: ${roomId}`);
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const userData = room.get(socket.id);
      
      room.delete(socket.id);
      
      socket.leave(roomId);
      socket.to(roomId).emit('user-left', {
        userId: socket.id,
        user: userData
      });

      if (room.size === 0) {
        rooms.delete(roomId);
      }
    }

    socketToRoom.delete(socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    activeRooms: rooms.size
  });
});

// Get room info
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.json({ exists: false, userCount: 0 });
  }

  const users = [];
  for (const [socketId, userData] of room.entries()) {
    users.push(userData);
  }

  res.json({ 
    exists: true, 
    userCount: room.size,
    users
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io server ready`);
  console.log(`🗄️ MySQL connected`);
});
