import API from "./axios";

export const signup = (data) => API.post("/auth/signup/", data);
export const getUser = () => API.get("/auth/me/");