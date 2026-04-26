import React, { useState } from "react";
import { Box, TextField, Button, Typography, Paper } from "@mui/material";
import { signup } from "../api/auth";

export default function Signup({ onSwitch }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (
      !form.name.trim() ||
      !form.username.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      alert("Please fill in all required fields.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await signup({
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
      });
      if (res?.data?.email_sent) {
        alert("Signup successful! Please check your email to verify your account.");
      } else if (res?.data?.verify_url) {
        alert(
          `Signup successful! Email service is not configured, use this verification link:\n${res.data.verify_url}`
        );
      } else {
        alert("Signup successful! Please verify your email before logging in.");
      }
      onSwitch();
    } catch (err) {
      console.error("Signup failed:", err);
      alert("Signup failed. Please try again.");
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
          Create your account
        </Typography>
        <Typography variant="body2" color="#6b7280" mt={0.5} mb={3}>
          Join Phoenix AI to start chatting with your documents.
        </Typography>

        <TextField
          fullWidth
          label="Full name"
          margin="normal"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <TextField
          fullWidth
          label="Username"
          margin="normal"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
        <TextField
          fullWidth
          label="Email"
          type="email"
          margin="normal"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <TextField
          fullWidth
          type="password"
          label="Password"
          margin="normal"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <TextField
          fullWidth
          type="password"
          label="Confirm password"
          margin="normal"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          error={Boolean(form.confirmPassword) && form.password !== form.confirmPassword}
          helperText={
            Boolean(form.confirmPassword) && form.password !== form.confirmPassword
              ? "Passwords do not match"
              : " "
          }
        />

        <Button
          fullWidth
          onClick={handleSubmit}
          variant="contained"
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
          {isSubmitting ? "Creating account..." : "Sign up"}
        </Button>

        <Button
          fullWidth
          onClick={onSwitch}
          sx={{ mt: 1, textTransform: "none", color: "#374151" }}
        >
          Already have an account? Log in
        </Button>
      </Paper>
    </Box>
  );
}