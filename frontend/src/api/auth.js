import API from "./axios";

export const signup = (data) => API.post("/auth/signup/", data);
export const verifyEmail = (uid, token) =>
  API.get("/auth/verify-email/", { params: { uid, token } });
export const getUser = () => API.get("/auth/me/");