import API from "./axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export const getConversations = async (query = "") => {
  const res = await API.get("/conversations/", {
    params: query ? { q: query } : {},
  });
  return res.data;
};

export const getMessages = async (conversationId) => {
  const res = await API.get(`/messages/${conversationId}/`);
  return res.data.messages;
};

export const uploadFile = async (file, conversationId = null) => {
  const formData = new FormData();
  formData.append("file", file);
  if (conversationId) {
    formData.append("conversation_id", conversationId);
  }

  const res = await API.post("/upload/", formData);
  return res.data;
};

export const streamMessage = async (message, conversationId, onChunk, onDone) => {
  const res = await fetch(`${BASE_URL}/chat/stream/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let fullText = "";
  let convId = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    let chunk = decoder.decode(value);
    
    if (chunk.includes("[CONV_ID]")) {
      const match = chunk.match(/\[CONV_ID\](.*?)\[\/CONV_ID\]/);
      if (match) {
        convId = match[1];
        chunk = chunk.replace(match[0], "");
      }
    }

    fullText += chunk;
    onChunk(chunk);
  }

  onDone && onDone(fullText, convId);
};

export const deleteConversation = (id) =>
  API.delete(`/conversation/${id}/delete/`);

export const getDocuments = () => API.get("/documents/");
export const deleteDocument = (id) =>
  API.delete(`/documents/${id}/delete/`);