import React, { useEffect, useState } from "react";
import {
  Box,
  List,
  ListItem,
  Button,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import {
  getConversations,
  getDocuments,
  deleteConversation,
} from "../api/chat";

export default function Sidebar({ setConversationId, docsVersion }) {
  const [conversations, setConversations] = useState([]);
  const [docs, setDocs] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [chatSearch, setChatSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      load(chatSearch);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [chatSearch]);

  useEffect(() => {
    loadDocs();
  }, [docsVersion]);

  const load = async (query = "") => {
    const data = await getConversations(query);
    setConversations(data);
  };

  const loadDocs = async () => {
    const res = await getDocuments();
    setDocs(res.data);
  };

  const openConversationMenu = (event, conversation) => {
    setMenuAnchorEl(event.currentTarget);
    setSelectedConversation(conversation);
  };

  const closeConversationMenu = () => {
    setMenuAnchorEl(null);
    setSelectedConversation(null);
  };

  const handleShareConversation = async () => {
    if (!selectedConversation) return;
    const shareUrl = `${window.location.origin}?conversationId=${selectedConversation.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("Chat link copied to clipboard.");
    } catch (err) {
      console.error("Failed to copy share link:", err);
      alert(`Share link: ${shareUrl}`);
    } finally {
      closeConversationMenu();
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    await deleteConversation(selectedConversation.id);
    await load(chatSearch);
    closeConversationMenu();
  };

  return (
    <Box width="260px" bgcolor="#e5e7eb" color="#111827" p={2}>

      {/* ➕ New Chat */}
      <Button
        fullWidth
        variant="contained"
        sx={{
          mb: 2,
          py: 1.2,
          fontWeight: 700,
          textTransform: "none",
          backgroundColor: "#d1d5db",
          color: "#111827",
          border: "1px solid #9ca3af",
          boxShadow: "0 4px 10px rgba(17, 24, 39, 0.08)",
          "&:hover": {
            backgroundColor: "#9ca3af",
          },
        }}
        onClick={() => setConversationId(null)}
        startIcon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="16"
            height="16"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        }
      >
        New Chat
      </Button>
      <TextField
        fullWidth
        placeholder="Search chats"
        value={chatSearch}
        onChange={(event) => setChatSearch(event.target.value)}
        sx={{
          mb: 2,
          "& .MuiOutlinedInput-root": {
            backgroundColor: "#f9fafb",
            borderRadius: "10px",
          },
        }}
      />
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel id="documents-dropdown-label"></InputLabel>
        <Select
          labelId="documents-dropdown-label"
          value={selectedDocId}
          label="Documents"
          onChange={(event) => setSelectedDocId(event.target.value)}
          displayEmpty
          sx={{ backgroundColor: "#f9fafb", borderRadius: "10px" }}
        >
          <MenuItem value="">
            <em>{docs.length ? "Select a document" : "No documents uploaded"}</em>
          </MenuItem>
          {docs.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              {d.name.split("/").pop()}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <List>
        {conversations.map((c) => (
          <ListItem
            key={c.id}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              borderRadius: 1,
              "&:hover": { backgroundColor: "#d1d5db" },
            }}
          >
            <span
              style={{
                cursor: "pointer",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginRight: "8px",
              }}
              onClick={() => setConversationId(c.id)}
            >
              {c.title}
            </span>

            <IconButton
              size="small"
              onClick={(event) => openConversationMenu(event, c)}
              sx={{ color: "#374151" }}
            >
              ⋮
            </IconButton>
          </ListItem>
        ))}
      </List>
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={closeConversationMenu}
      >
        <MenuItem onClick={handleShareConversation}>Share</MenuItem>
        <MenuItem onClick={handleDeleteConversation} sx={{ color: "#b91c1c" }}>
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}