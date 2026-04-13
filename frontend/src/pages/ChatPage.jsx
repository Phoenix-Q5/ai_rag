import React, { useState } from "react";
import { Box } from "@mui/material";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import Navbar from "../components/Navbar";

export default function ChatPage() {
  const [conversationId, setConversationId] = useState(null);

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      
      <Navbar />

      <Box display="flex" flex={1}>
        <Sidebar setConversationId={setConversationId} />
        <ChatWindow
          conversationId={conversationId}
          setConversationId={setConversationId}
        />
      </Box>
    </Box>
  );
}