import React, { useState } from "react";
import { Box, TextField, Button } from "@mui/material";
import { signup } from "../api/auth";

export default function Signup({ onSwitch }) {
  const [form, setForm] = useState({});

  const handleSubmit = async () => {
    await signup(form);
    alert("Signup successful!");
    onSwitch();
  };

  return (
    <Box width="300px" mx="auto" mt={10}>
      <TextField fullWidth label="Name" onChange={e => setForm({...form, name: e.target.value})} />
      <TextField fullWidth label="Username" onChange={e => setForm({...form, username: e.target.value})} />
      <TextField fullWidth label="Email" onChange={e => setForm({...form, email: e.target.value})} />
      <TextField fullWidth type="password" label="Password" onChange={e => setForm({...form, password: e.target.value})} />

      <Button fullWidth onClick={handleSubmit} variant="contained">
        Sign Up
      </Button>

      <Button onClick={onSwitch}>Already have account?</Button>
    </Box>
  );
}