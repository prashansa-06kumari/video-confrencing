import React, { useEffect, useState } from "react";
import HomeCard from "../components/HomeCard";
import { v4 as uuid } from "uuid";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

// icons
import { MdVideoCall as NewCallIcon } from "react-icons/md";
import { MdAddBox as JoinCallIcon } from "react-icons/md";
import { BsCalendarDate as CalenderIcon } from "react-icons/bs";
import { MdRefresh as ResetIcon } from "react-icons/md";

const Home = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date());
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [inviteId, setInviteId] = useState("");

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const days = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];

  useEffect(() => {
    const timerId = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(timerId);
  }, []);

  const createNewMeeting = () => {
    let sharedRoomId = localStorage.getItem("shared_room_id");
    if (!sharedRoomId) {
      sharedRoomId = uuid();
      localStorage.setItem("shared_room_id", sharedRoomId);
    }
    navigate(`/room/${sharedRoomId}`);
  };

  const resetSharedRoom = () => {
    localStorage.removeItem("shared_room_id");
    alert("Room reset! You can now start a fresh meeting.");
  };

  const joinMeeting = (e) => {
    e.preventDefault();
    if (inviteId.trim()) {
      navigate(`/room/${inviteId.trim()}`);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-darkBlue1 text-slate-400 p-6 md:p-12 overflow-hidden relative">
      {/* Background blobs for depth */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue/5 rounded-full blur-3xl -mr-64 -mt-64" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-yellow/5 rounded-full blur-3xl -ml-48 -mb-48" />

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
        
        {/* Left Side: Actions */}
        <div className="lg:col-span-7 space-y-8">
          <header>
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-5xl md:text-6xl font-black text-white leading-tight"
            >
              Connect with anyone, <br/>
              <span className="text-yellow text-glow">anywhere.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg text-slate-400 mt-4 max-w-lg"
            >
              Sonic Meet provides secure, high-quality video conferencing for teams and friends. 
              Start a meeting with a single click.
            </motion.p>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <motion.div 
              whileHover={{ y: -5 }}
              onClick={createNewMeeting} 
              className="cursor-pointer group"
            >
              <div className="h-full p-8 rounded-3xl bg-yellow shadow-xl shadow-yellow/20 group-hover:bg-yellow/90 transition-all flex flex-col justify-between min-h-[200px]">
                <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center">
                  <NewCallIcon className="text-3xl text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">New Meeting</h3>
                  <p className="text-white/80 text-sm mt-1">Start or join the shared local session</p>
                </div>
              </div>
            </motion.div>

            <div className="relative group h-full">
              <motion.div 
                whileHover={{ y: -5 }}
                onClick={() => setShowJoinInput(!showJoinInput)} 
                className="cursor-pointer h-full p-8 rounded-3xl bg-slate-800/50 border border-white/5 shadow-xl hover:bg-slate-800/80 transition-all flex flex-col justify-between min-h-[200px]"
              >
                <div className="bg-blue/20 w-12 h-12 rounded-2xl flex items-center justify-center text-blue">
                  <JoinCallIcon className="text-3xl" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Join Meeting</h3>
                  <p className="text-slate-400 text-sm mt-1">Via invitation link or ID</p>
                </div>
              </motion.div>
              
              <AnimatePresence>
                {showJoinInput && (
                  <motion.form 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    onSubmit={joinMeeting}
                    className="absolute top-full left-0 right-0 mt-4 p-6 rounded-3xl bg-slate-900 border border-white/10 z-50 shadow-2xl"
                  >
                    <input
                      autoFocus
                      type="text"
                      placeholder="Enter Room ID"
                      className="w-full bg-slate-800 border border-white/10 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-yellow/50 mb-4"
                      value={inviteId}
                      onChange={(e) => setInviteId(e.target.value)}
                    />
                    <button 
                      type="submit"
                      className="w-full bg-yellow text-white font-bold py-4 rounded-2xl hover:bg-yellow/90 transition-all shadow-lg shadow-yellow/10"
                    >
                      JOIN NOW
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            <div className="p-6 rounded-3xl bg-slate-800/20 border border-white/5 flex items-center gap-4 hover:bg-slate-800/40 transition-all">
              <div className="bg-blue/10 p-3 rounded-xl text-blue">
                <CalenderIcon size={24} />
              </div>
              <div>
                <h4 className="text-white font-bold">Schedule</h4>
                <p className="text-xs text-slate-500">Plan ahead</p>
              </div>
            </div>
            <div 
              onClick={resetSharedRoom}
              className="p-6 rounded-3xl bg-slate-800/20 border border-white/5 flex items-center gap-4 hover:bg-red-500/10 transition-all cursor-pointer group"
            >
              <div className="bg-slate-700/30 p-3 rounded-xl text-slate-400 group-hover:text-red-400 transition-colors">
                <ResetIcon size={24} />
              </div>
              <div>
                <h4 className="text-white font-bold">Reset Room</h4>
                <p className="text-xs text-slate-500">Clear shared ID</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Clock & Info */}
        <div className="lg:col-span-5">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-full rounded-[2.5rem] bg-[url('https://images.unsplash.com/photo-1516387091243-9458ed41281d?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center relative overflow-hidden group shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-darkBlue1 via-transparent to-transparent" />
            
            <div className="absolute bottom-0 left-0 right-0 p-10">
              <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-8">
                <h2 className="text-6xl font-thin text-white tracking-tighter mb-2">
                  {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </h2>
                <p className="text-xl text-slate-300 font-medium uppercase tracking-widest">
                  {days[date.getDay()]}, {date.getDate()} {months[date.getMonth()]}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

      </div>

      <footer className="mt-16 text-center text-sm text-slate-600">
        <p>Built with ❤️ for seamless collaboration • Sonic Meet © 2024</p>
      </footer>
    </div>
  );
};

export default Home;
