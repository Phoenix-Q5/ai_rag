import React from "react";
import { Box } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function MessageBubble({ msg }) {
  return (
    <Box maxWidth="75%" ml={msg.role === "user" ? "auto" : 0} mb={2}>
      <Box
        bgcolor={msg.role === "user" ? "#d1d5db" : "#e5e7eb"}
        color="#111827"
        px={1.5}
        py={1}
        borderRadius={4}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ inline, className, children }) {
              const match = /language-(\w+)/.exec(className || "");
              return !inline ? (
                <SyntaxHighlighter
                  style={oneDark}
                  language={match ? match[1] : "javascript"}
                  PreTag="div"
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              ) : (
                <code style={{ background: "#d1d5db", padding: "2px 6px" }}>
                  {children}
                </code>
              );
            },
          }}
        >
          {msg.content}
        </ReactMarkdown>
      </Box>
    </Box>
  );
}