import { Buffer } from 'buffer';
import process from 'process';
import React from "react";
import ReactDOM from "react-dom";
import App from "./components/App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { BrowserRouter as Router } from "react-router-dom";

// Polyfill for 'process' and 'Buffer' in browser for Webpack 5 compatibility (simple-peer fix)
// MUST BE AT THE VERY TOP before other imports
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.process = process;
  if (!window.process.env) window.process.env = {};
  if (!window.process.nextTick) {
    window.process.nextTick = (fn, ...args) => setTimeout(() => fn(...args), 0);
  }
}

ReactDOM.render(
  <AuthProvider>
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
    </Router>
  </AuthProvider>,
  document.getElementById("root")
);
