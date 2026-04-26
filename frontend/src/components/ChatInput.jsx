import React, { useState } from "react";
import { Box, TextField, IconButton } from "@mui/material";
import { streamMessage, uploadFile } from "../api/chat";

export default function ChatInput({
  setMessages,
  conversationId,
  setConversationId,
  onDocumentUploaded,
  setIsStreaming,
}) {
  const [input, setInput] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleSend = async () => {
    if (!input || uploading) return;

    const userMsg = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);

    setInput("");

    let aiMsg = { role: "ai", content: "" };
    setMessages((prev) => [...prev, aiMsg]);

    setIsStreaming && setIsStreaming(true);
    try {
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
    } catch (err) {
      console.error("Stream failed:", err);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "ai", content: "Sorry, something went wrong while streaming." },
      ]);
    } finally {
      setIsStreaming && setIsStreaming(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      setUploading(true);
      await uploadFile(file, conversationId);
      onDocumentUploaded && onDocumentUploaded();
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `Uploaded document: ${file.name}` },
      ]);
    } catch (err) {
      console.error("Document upload failed:", err);
      alert("Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <Box
      display="flex"
      gap={1}
      p={0.8}
      border="1px solid #d1d5db"
      borderRadius="14px"
      bgcolor="#eef2f7"
      alignItems="center"
    >
      <IconButton
        component="label"
        aria-label="upload document"
        disabled={uploading}
        sx={{
          alignSelf: "center",
          width: 44,
          height: 44,
          borderRadius: "12px",
          backgroundColor: "#e5e7eb",
          color: "#374151",
          transition: "all 0.2s ease",
          "&:hover": { backgroundColor: "#d1d5db", transform: "translateY(-1px)" },
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="18"
          height="18"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5-5 5 5" />
          <path d="M12 15V5" />
        </svg>
        <input type="file" hidden onChange={handleUpload} />
      </IconButton>
      <TextField
        variant="outlined"
        fullWidth
        placeholder="Ask anything..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        sx={{
          input: { color: "#111827" },
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            "& fieldset": { borderColor: "#d1d5db" },
            "&:hover fieldset": { borderColor: "#9ca3af" },
            "&.Mui-focused fieldset": { borderColor: "#6b7280" },
          },
          "& .MuiInputLabel-root": { color: "#6b7280" },
        }}
      />

      <IconButton
        onClick={handleSend}
        aria-label="send message"
        disabled={uploading || !input.trim()}
        sx={{
          alignSelf: "center",
          width: 44,
          height: 44,
          borderRadius: "12px",
          backgroundColor: "#d1d5db",
          color: "#111827",
          transition: "all 0.2s ease",
          "&:hover": { backgroundColor: "#9ca3af", transform: "translateY(-1px)" },
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          width="20"
          height="20"
        >
          <path d="M3.4 20.4a.75.75 0 0 1-.96-.96l2.17-6.5a.75.75 0 0 1 .5-.48l7.53-2.15-7.53-2.15a.75.75 0 0 1-.5-.48L2.44 1.2a.75.75 0 0 1 .96-.96l18 7.2a.75.75 0 0 1 0 1.38l-18 7.2Z" />
        </svg>
      </IconButton>
    </Box>
  );
}