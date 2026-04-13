import React, { useContext } from "react";
import { Box, Typography, Button } from "@mui/material";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
    const { logout } = useContext(AuthContext);
    const user = JSON.parse(localStorage.getItem("user"));
    const username = localStorage.getItem("username");

    return (
        <Box
            height="60px"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            px={3}
            bgcolor="#020617"
            color="#fff"
            borderBottom="1px solid #1e293b"
        >
            <Typography variant="h6" fontWeight="bold">
                ⚡ Phoenix AI
            </Typography>

            <Box display="flex" alignItems="center" gap={2}>

                <Typography>
                    {user?.name || user?.username || "User"}
                </Typography>

                <Button
                    variant="outlined"
                    color="error"
                    onClick={logout}
                >
                    Logout
                </Button>
            </Box>
        </Box>
    );
}