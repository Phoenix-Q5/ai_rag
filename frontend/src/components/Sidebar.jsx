import React, { useEffect, useState } from "react";
import { Box, List, ListItem, Button } from "@mui/material";
import {
  getConversations,
  uploadFile,
  getDocuments,
  deleteDocument,
  deleteConversation,
} from "../api/chat";

export default function Sidebar({ setConversationId }) {
  const [conversations, setConversations] = useState([]);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    load();
    loadDocs();
  }, []);

  const load = async () => {
    const data = await getConversations();
    setConversations(data);
  };

  const loadDocs = async () => {
    const res = await getDocuments();
    setDocs(res.data);
  };

  // 📎 Upload
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      await uploadFile(file);
      alert("✅ Uploaded & indexed!");
      loadDocs(); // 🔥 refresh docs
    } catch (err) {
      console.error(err);
      alert("❌ Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box width="260px" bgcolor="#020617" color="#fff" p={2}>

      {/* ➕ New Chat */}
      <Button
        fullWidth
        variant="contained"
        sx={{ mb: 2 }}
        onClick={() => setConversationId(null)}
      >
        + New Chat
      </Button>

      {/* 📎 Upload */}
      <Button
        fullWidth
        variant="outlined"
        component="label"
        sx={{ mb: 2 }}
        disabled={uploading}
      >
        {uploading ? "Uploading..." : "Upload Document"}
        <input type="file" hidden onChange={handleUpload} />
      </Button>

      {/* 📂 Documents (NEW SECTION) */}
      <Box mb={2}>
        <strong>📂 Documents</strong>

        {docs.length === 0 && (
          <Box fontSize="12px" color="#94a3b8">
            No documents uploaded
          </Box>
        )}

        {docs.map((d) => (
          <Box
            key={d.id}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mt={1}
            fontSize="14px"
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {d.name.split("/").pop()}
            </span>

            <Button
              size="small"
              color="error"
              onClick={async () => {
                await deleteDocument(d.id);
                loadDocs(); // 🔥 refresh
              }}
            >
              ✕
            </Button>
          </Box>
        ))}
      </Box>

      <List>
        {conversations.map((c) => (
          <ListItem
            key={c.id}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              borderRadius: 1,
              "&:hover": { backgroundColor: "#1e293b" },
            }}
          >
            <span
              style={{ cursor: "pointer" }}
              onClick={() => setConversationId(c.id)}
            >
              {c.title}
            </span>

            <Button
              size="small"
              color="error"
              onClick={async () => {
                await deleteConversation(c.id);
                load();
              }}
            >
              ✕
            </Button>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}