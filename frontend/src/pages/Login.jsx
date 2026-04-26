import { useState, useContext } from "react";
import { Box, TextField, Button, Typography, Paper } from "@mui/material";
import API from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import React from "react";
import { getUser, verifyEmail } from "../api/auth";

export default function Login({ onSwitch }) {
  const { login } = useContext(AuthContext);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
    const token = params.get("token");
    if (!uid || !token) return;

    const runVerification = async () => {
      try {
        await verifyEmail(uid, token);
        alert("Email verified successfully. You can now log in.");
      } catch (err) {
        console.error("Email verification failed:", err);
        alert("Email verification link is invalid or expired.");
      } finally {
        window.history.replaceState({}, "", window.location.pathname);
      }
    };

    runVerification();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      alert("Please enter username and password.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await API.post("/auth/login/", {
        username,
        password,
      });
      const token = res.data.access;
      localStorage.setItem("token", token);

      const userRes = await getUser();
      localStorage.setItem("user", JSON.stringify(userRes.data));

      login(token);
    } catch (err) {
      console.error("Login failed:", err);
      const inactiveMessage = err?.response?.data?.detail;
      if (
        typeof inactiveMessage === "string" &&
        inactiveMessage.toLowerCase().includes("no active account")
      ) {
        alert("Account not verified yet. Please verify your email first.");
      } else {
        alert("Login failed. Please check your credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bgcolor="#f3f4f6"
      px={2}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 420,
          p: 4,
          borderRadius: 3,
          border: "1px solid #d1d5db",
          bgcolor: "#ffffff",
        }}
      >
        <Typography variant="h5" fontWeight={700} color="#111827">
          Welcome back
        </Typography>
        <Typography variant="body2" color="#6b7280" mt={0.5} mb={3}>
          Log in to continue your Phoenix AI workspace.
        </Typography>
        <TextField
          fullWidth
          label="Username"
          margin="normal"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <TextField
          fullWidth
          type="password"
          label="Password"
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          fullWidth
          variant="contained"
          onClick={handleLogin}
          disabled={isSubmitting}
          sx={{
            mt: 1,
            py: 1.1,
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2,
            backgroundColor: "#111827",
            "&:hover": { backgroundColor: "#1f2937" },
          }}
        >
          {isSubmitting ? "Logging in..." : "Log in"}
        </Button>

        <Box display="flex" justifyContent="space-between" mt={1}>
          <Button
            size="small"
            onClick={() => alert("Please contact support to reset your password.")}
            sx={{ textTransform: "none", color: "#6b7280" }}
          >
            Forgot password?
          </Button>
          <Button
            size="small"
            onClick={onSwitch}
            sx={{ textTransform: "none", color: "#374151" }}
          >
            Sign up
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}