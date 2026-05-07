# Sonic Meet - Video Conferencing Application

A powerful, real-time video conferencing application built with React, Node.js, Socket.io, WebRTC, and MySQL.

## 🚀 Features

- **🎥 Real-time Video & Audio**: High-quality conferencing using WebRTC.
- **🎨 Collaborative Whiteboard**: Share a canvas and brainstorm together in real-time.
- **🙋 Hand Raising**: Notify the host when you want to speak with audio and visual cues.
- **📊 Live Polls & Surveys**: Create and launch polls during meetings for instant feedback.
- **📁 File Sharing**: Share files directly in chat, stored securely and linked to MySQL.
- **💬 In-meeting Chat**: Real-time messaging with chat history persistence.
- **🔒 Secure Auth**: Firebase Authentication (Google & Email/Password).
- **📱 Responsive UI**: Modern, dark-themed design built with Tailwind CSS and Framer Motion.

## 🛠️ Tech Stack

- **Frontend**: React, Socket.io-client, Firebase, Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express, Socket.io, Multer.
- **Database**: MySQL with Sequelize ORM.
- **WebRTC**: Native RTCPeerConnection API.

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL Server
- Firebase Project (for Auth)

## ⚙️ Setup Instructions

### 1. Database Setup
1. Create a MySQL database named `sonic_meet`.
2. Configure your credentials in `video-app/backend/.env`.

### 2. Backend Setup
```bash
cd video-app/backend
npm install
# Configure your .env file
npm start
```
**Backend `.env` example:**
```env
PORT=4000
DB_NAME=sonic_meet
DB_USER=your_user
DB_PASS=your_password
DB_HOST=localhost
REACT_APP_SOCKET_BACKEND_URL=http://localhost:4000
```

### 3. Frontend Setup
```bash
cd video-app/client
npm install
# Configure your .env file
npm start
```
**Frontend `.env` example:**
```env
REACT_APP_SOCKET_BACKEND_URL=http://localhost:4000
```

## 📸 Screenshots
You can find screenshots of the application in the `video-app/screenshot/` directory.

## 📄 License
This project is MIT licensed.
