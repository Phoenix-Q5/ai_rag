import React, { useState } from "react";
import { Box } from "@mui/material";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import Navbar from "../components/Navbar";
import ImageStudio from "../components/ImageStudio";

export default function ChatPage() {
  const [conversationId, setConversationId] = useState(null);
  const [docsVersion, setDocsVersion] = useState(0);
  const [mode, setMode] = useState("chat");

  const handleDocumentUploaded = () => {
    setDocsVersion((prev) => prev + 1);
  };

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <Navbar mode={mode} onModeChange={setMode} />

      {mode === "chat" ? (
        <Box display="flex" flex={1}>
          <Sidebar setConversationId={setConversationId} docsVersion={docsVersion} />
          <ChatWindow
            conversationId={conversationId}
            setConversationId={setConversationId}
            onDocumentUploaded={handleDocumentUploaded}
          />
        </Box>
      ) : (
        <ImageStudio />
      )}
    </Box>
  );
}