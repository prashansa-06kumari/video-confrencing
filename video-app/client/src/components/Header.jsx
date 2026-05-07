import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AiOutlineLogout as LogOutIcon } from "react-icons/ai";
import { motion } from "framer-motion";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="h-20 px-6 bg-darkBlue1/80 backdrop-blur-md text-slate-300 w-full flex items-center justify-between border-b border-white/5 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-yellow p-2 rounded-lg group-hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xl font-black text-white tracking-tighter uppercase">Sonic Meet</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-4 bg-slate-800/40 p-1.5 pr-4 rounded-full border border-white/5 hover:border-white/10 transition-all">
            <div className="relative group h-9 w-9 rounded-full overflow-hidden shadow-inner">
              <img
                className="h-full w-full rounded-full object-cover"
                src={user?.photoURL}
                alt={user?.displayName}
              />
              <button
                className="absolute inset-0 flex opacity-0 group-hover:opacity-100 items-center justify-center bg-black/60 transition-opacity cursor-pointer"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOutIcon className="text-white text-lg" />
              </button>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white leading-none">{user.displayName}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Online</span>
            </div>
          </div>
        ) : (
          <Link
            to="/login"
            className="bg-yellow/10 text-yellow hover:bg-yellow hover:text-white px-6 py-2 rounded-full font-bold text-sm transition-all border border-yellow/20"
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
};

export default Header;
