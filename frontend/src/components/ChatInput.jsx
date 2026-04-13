import React, { useState } from "react";
import { Box, TextField, Button } from "@mui/material";
import { streamMessage } from "../api/chat";

export default function ChatInput({
  setMessages,
  conversationId,
  setConversationId,
}) {
  const [input, setInput] = useState("");

  const handleSend = async () => {
    if (!input) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);

    setInput("");

    let aiMsg = { role: "ai", content: "" };
    setMessages((prev) => [...prev, aiMsg]);

    await streamMessage(
      input,
      conversationId,
      (chunk) => {
        aiMsg.content += chunk;
        setMessages((prev) => [...prev.slice(0, -1), aiMsg]);
      },
      (fullText, newConversationId) => {
        if (!conversationId && newConversationId) {
          setConversationId(newConversationId);
        }
      }
    );
  };

  return (
    <Box display="flex" gap={1}>
      <TextField
        variant="outlined"
        fullWidth
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        sx={{
          input: { color: "white" },
          "& .MuiOutlinedInput-root": {
            "& fieldset": { borderColor: "white" },
            "&:hover fieldset": { borderColor: "white" },
            "&.Mui-focused fieldset": { borderColor: "white" },
          },
          "& .MuiInputLabel-root": { color: "white" },
        }}
      />

      <Button variant="contained" onClick={handleSend}>
        Send
      </Button>
    </Box>
  );
}