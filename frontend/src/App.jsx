import { useContext, useState } from "react";
import { AuthContext } from "./context/AuthContext";
import ChatPage from "./pages/ChatPage";
import Login from "./pages/Login";
import React from "react";
import Signup from "./pages/Signup";

export default function App() {
  const { token } = useContext(AuthContext);
  const [showSignup, setShowSignup] = useState(false);
  return token ? (
    <ChatPage />
  ) : showSignup ? (
    <Signup onSwitch={() => setShowSignup(false)} />
  ) : (
    <Login onSwitch={() => setShowSignup(true)} />
  );
}