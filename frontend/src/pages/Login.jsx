import { useState, useContext } from "react";
import { Box, TextField, Button } from "@mui/material";
import API from "../api/axios";
import { AuthContext } from "../context/AuthContext";
import React from "react";
import { getUser } from "../api/auth";

export default function Login() {
  const { login } = useContext(AuthContext);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    const res = await API.post("/auth/login/", {
      username,
      password,
    });
    const token = res.data.access;
    localStorage.setItem("token", token);

    const userRes = await getUser();
    localStorage.setItem("user", JSON.stringify(userRes.data));

    login(token);
  };

  return (
    <Box display="flex" height="100vh" justifyContent="center" alignItems="center">
      <Box width="300px">
        <TextField
          fullWidth
          label="Username"
          margin="normal"
          onChange={(e) => setUsername(e.target.value)}
        />

        <TextField
          fullWidth
          type="password"
          label="Password"
          margin="normal"
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button fullWidth variant="contained" onClick={handleLogin}>
          Login
        </Button>
      </Box>
    </Box>
  );
}