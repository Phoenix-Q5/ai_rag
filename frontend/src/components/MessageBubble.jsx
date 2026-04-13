import React from "react";
import { Box } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

export default function MessageBubble({ msg }) {
  return (
    <Box
      maxWidth="75%"
      ml={msg.role === "user" ? "auto" : 0}
      mb={2}
    >
      <Box
        bgcolor={msg.role === "user" ? "#2563eb" : "#1e293b"}
        color="#fff"
        p={2}
        borderRadius={3}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ inline, className, children, ...props }) {
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
                <code style={{ background: "#333", padding: "2px 6px" }}>
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