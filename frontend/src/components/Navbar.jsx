import React, { useContext } from "react";
import { Box, Typography, Button } from "@mui/material";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
    const { logout } = useContext(AuthContext);
    const user = JSON.parse(localStorage.getItem("user"));
    const username = localStorage.getItem("username");
    const rawDisplayName = user?.name || user?.username || username || "User";
    const displayName = String(rawDisplayName)
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());

    return (
        <Box
            height="60px"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            px={3}
            bgcolor="#e5e7eb"
            color="#111827"
            borderBottom="1px solid #d1d5db"
        >
            <Typography variant="h6" fontWeight="bold">
             Phoenix AI
            </Typography>

            <Box display="flex" alignItems="center" gap={2}>

                <Typography variant="body1" fontWeight="bold">
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
                        boxShadow: "none",
                        "&:hover": {
                            backgroundColor: "#9ca3af",
                            boxShadow: "none",
                        },
                    }}
                >
                </Button>
            </Box>
        </Box>
    );
}