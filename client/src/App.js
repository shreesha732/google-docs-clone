import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { v4 as uuidV4 } from "uuid";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase";
import TextEditor from "./components/TextEditor";
import MyDocuments from "./components/MyDocuments";

export default function App() {
  const [user, setUser] = useState(null);

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  if (!user) {
    return (
      <div style={{ textAlign: "center", marginTop: "5rem" }}>
        <h2>Google Docs Clone</h2>
        <button onClick={handleLogin} style={{ padding: "10px 20px", fontSize: "16px" }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <Router>
      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <a href="/my-docs" style={{ fontSize: "16px", textDecoration: "none" }}>
          📄 View My Documents
        </a>
      </div>
      <Routes>
        <Route path="/" element={<Navigate to={`/docs/${uuidV4()}`} />} />
        <Route path="/docs/:id" element={<TextEditor user={user} />} />
        <Route path="/my-docs" element={<MyDocuments user={user} />} />
      </Routes>
    </Router>
  );
}
