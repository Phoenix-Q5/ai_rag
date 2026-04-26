import React, { useState, useEffect, useRef } from "react";
import { Box, CircularProgress } from "@mui/material";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";
import { getMessages } from "../api/chat";

export default function ChatWindow({ conversationId, setConversationId, onDocumentUploaded }) {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef();

  // 🔄 Load messages when switching conversations
  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const loadMessages = async (convId) => {
    try {
      const data = await getMessages(convId);
      setMessages(Array.isArray(data) ? data : data?.messages || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  // 🔽 Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box flex={1} display="flex" flexDirection="column" bgcolor="#f3f4f6">
      
      {/* 💬 Messages */}
      <Box flex={1} p={2} overflow="auto">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {isStreaming && (
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            width="fit-content"
            px={2}
            py={1}
            borderRadius={3}
            bgcolor="#e5e7eb"
            color="#374151"
          >
            <CircularProgress size={16} thickness={5} color="inherit" />
            <span style={{ fontSize: "14px" }}>Thinking...</span>
          </Box>
        )}
        <div ref={bottomRef} />
      </Box>

      {/* ⌨️ Input */}
      <Box p={2} borderTop="1px solid #d1d5db" bgcolor="#f9fafb">
        <ChatInput
          setMessages={setMessages}
          conversationId={conversationId}
          setConversationId={setConversationId}
          onDocumentUploaded={onDocumentUploaded}
          setIsStreaming={setIsStreaming}
        />
      </Box>
    </Box>
  );
}