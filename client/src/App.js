import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { v4 as uuidV4 } from "uuid";
import TextEditor from "./components/TextEditor";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to={`/docs/${uuidV4()}`} />} />
        <Route path="/docs/:id" element={<TextEditor />} />
      </Routes>
    </Router>
  );
}
