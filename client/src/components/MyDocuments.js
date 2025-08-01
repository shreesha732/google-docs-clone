import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function MyDocuments({ user }) {
  const [documents, setDocuments] = useState([]);

  useEffect(() => {
    const fetchDocs = async () => {
      const res = await fetch(`${BACKEND_URL}/api/user-documents/${user.uid}`);
      const data = await res.json();
      setDocuments(data);
    };
    if (user) fetchDocs();
  }, [user]);

  return (
    <div style={{ padding: "2rem" }}>
      <h2>🗂️ My Documents</h2>
      {documents.length === 0 ? (
        <p>No documents found.</p>
      ) : (
        <ul>
          {documents.map(doc => (
            <li key={doc._id}>
              <Link to={`/docs/${doc._id}`}>Open {doc._id}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

