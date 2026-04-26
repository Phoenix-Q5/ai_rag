import React, { useContext } from "react";
import { Box, Typography, Button } from "@mui/material";
import { AuthContext } from "../context/AuthContext";

export default function Navbar({ mode = "chat", onModeChange }) {
    const { logout } = useContext(AuthContext);
    const user = JSON.parse(localStorage.getItem("user"));
    const username = localStorage.getItem("username");
    const rawDisplayName = user?.name || user?.username || username || "User";
    const displayName = String(rawDisplayName)
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

    return (
        <Box
            height="64px"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            px={{ xs: 2, md: 3 }}
            bgcolor="#f3f4f6"
            color="#111827"
            borderBottom="1px solid #d1d5db"
            boxShadow="0 1px 2px rgba(15, 23, 42, 0.06)"
        >
            <Box display="flex" alignItems="center" gap={2}>
                <Typography variant="h6" fontWeight="bold">
                    Phoenix AI
                </Typography>
                <Box
                    display="flex"
                    gap={1}
                    p={0.5}
                    border="1px solid #d1d5db"
                    borderRadius="12px"
                    bgcolor="#e5e7eb"
                >
                    <Button
                        size="small"
                        onClick={() => onModeChange && onModeChange("chat")}
                        sx={{
                            textTransform: "none",
                            minWidth: 92,
                            borderRadius: "10px",
                            transition: "all 0.2s ease",
                            backgroundColor: mode === "chat" ? "#9ca3af" : "transparent",
                            color: "#111827",
                        }}
                    >
                        Chat
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onModeChange && onModeChange("image")}
                        sx={{
                            textTransform: "none",
                            minWidth: 110,
                            borderRadius: "10px",
                            transition: "all 0.2s ease",
                            backgroundColor: mode === "image" ? "#9ca3af" : "transparent",
                            color: "#111827",
                        }}
                    >
                        Image Studio
                    </Button>
                </Box>
            </Box>

            <Box display="flex" alignItems="center" gap={2}>

                <Typography variant="body1" fontWeight="bold" color="#374151">
                    {displayName}
                </Typography>

                <Button
                    variant="contained"
                    onClick={logout}
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
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <path d="M16 17l5-5-5-5" />
                            <path d="M21 12H9" />
                        </svg>
                    }
                    sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        borderRadius: "10px",
                        backgroundColor: "#d1d5db",
                        color: "#111827",
                        border: "1px solid #9ca3af",
                        boxShadow: "0 1px 1px rgba(17,24,39,0.04)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                            backgroundColor: "#9ca3af",
                            boxShadow: "0 2px 6px rgba(17,24,39,0.1)",
                        },
                    }}
                >
                    Logout
                </Button>
            </Box>
        </Box>
    );
}