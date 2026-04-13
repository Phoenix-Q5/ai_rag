import React, { useState, useEffect, useRef } from "react";
import { Box } from "@mui/material";
import ChatInput from "./ChatInput";
import MessageBubble from "./MessageBubble";
import { getMessages } from "../api/chat";

export default function ChatWindow({ conversationId, setConversationId }) {
  const [messages, setMessages] = useState([]);
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
      if (data && data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  // 🔽 Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Box flex={1} display="flex" flexDirection="column" bgcolor="#0f172a">
      
      {/* 💬 Messages */}
      <Box flex={1} p={2} overflow="auto">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </Box>

      {/* ⌨️ Input */}
      <Box p={2} borderTop="1px solid #1e293b">
        <ChatInput
          setMessages={setMessages}
          conversationId={conversationId}
          setConversationId={setConversationId}
        />
      </Box>
    </Box>
  );
}