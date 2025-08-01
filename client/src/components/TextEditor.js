import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { io } from "socket.io-client";

// ✅ Use environment variable for backend URL
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const SAVE_INTERVAL_MS = 2000;

export default function TextEditor({ user }) {
  const { id: documentId } = useParams();
  const [socket, setSocket] = useState();
  const [quill, setQuill] = useState();

  // ✅ Connect to backend
  useEffect(() => {
    const s = io(BACKEND_URL, {
      transports: ["websocket"],
    });
    setSocket(s);
    return () => s.disconnect();
  }, []);

  // ✅ Load document from backend
  useEffect(() => {
    if (!socket || !quill || !user) return;

    socket.once("load-document", (document) => {
      quill.setContents(document);
      quill.enable();
    });

    console.log("📤 Sending document request:", documentId, user?.uid);
    socket.emit("get-document", documentId, user.uid); // 👈 Send user.uid
  }, [socket, quill, documentId, user]);

  // ✅ Save document every 2 seconds
  useEffect(() => {
    if (!socket || !quill) return;

    const interval = setInterval(() => {
      socket.emit("save-document", quill.getContents());
    }, SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [socket, quill]);

  // ✅ Receive remote changes
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta) => {
      quill.updateContents(delta);
    };

    socket.on("receive-changes", handler);
    return () => socket.off("receive-changes", handler);
  }, [socket, quill]);

  // ✅ Send local changes
  useEffect(() => {
    if (!socket || !quill) return;

    const handler = (delta, oldDelta, source) => {
      if (source !== "user") return;
      socket.emit("send-changes", delta);
    };

    quill.on("text-change", handler);
    return () => quill.off("text-change", handler);
  }, [socket, quill]);

  // ✅ Set up editor on mount
  const wrapperRef = useCallback((wrapper) => {
    if (wrapper == null) return;
    wrapper.innerHTML = "";
    const editor = document.createElement("div");
    wrapper.append(editor);
    const q = new Quill(editor, { theme: "snow" });
    q.disable();
    q.setText("Loading...");
    setQuill(q);
  }, []);

  return (
    <>
      <a
        href="/my-docs"
        style={{
          display: "block",
          textAlign: "center",
          padding: "1rem",
          textDecoration: "none",
          color: "purple",
          fontWeight: "bold"
        }}
      >
        📄 View My Documents
      </a>

      <div className="container" ref={wrapperRef}></div>
    </>
  );
}
