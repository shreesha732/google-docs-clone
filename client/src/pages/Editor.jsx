import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiRequest } from '../utils/api';
import ShareModal from '../components/ShareModal';
import io from 'socket.io-client';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';
import {
  ArrowLeft,
  Share2,
  History,
  Sun,
  Moon,
  Clock,
  Eye,
  Edit3,
  Loader2,
  FileDown,
  ChevronRight,
  Plus,
  Undo2,
  Redo2,
  Keyboard,
  Info,
  Save,
  CheckCircle,
  CloudOff,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';

// Register Quill Cursors Module
Quill.register('modules/cursors', QuillCursors);

export default function Editor() {
  const { id: docId } = useParams();
  const auth = useAppAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // Refs for DOM nodes and active states
  const editorRef = useRef(null);
  const quillInstance = useRef(null);
  const socketRef = useRef(null);
  const titleInputRef = useRef(null);

  // Document states
  const [doc, setDoc] = useState(null);
  const [permission, setPermission] = useState('viewer'); // 'owner' | 'editor' | 'commenter' | 'viewer'
  const [title, setTitle] = useState('');
  const [saveStatus, setSaveStatus] = useState('Saved'); // 'Saved' | 'Saving...' | 'Offline' | 'Error'
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  // Collaborators presence state
  const [collaborators, setCollaborators] = useState([]);

  // UI Panels states
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [versionSidebarOpen, setVersionSidebarOpen] = useState(false);
  const [keyboardModalOpen, setKeyboardModalOpen] = useState(false);
  const [statsPanelOpen, setStatsPanelOpen] = useState(true);

  // Statistics
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Versions history lists
  const [versions, setVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [previewingVersion, setPreviewingVersion] = useState(null); // stores version metadata when preview active
  const [snapshotTitle, setSnapshotTitle] = useState('');
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

  // Global Toasts state
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const toastId = Date.now();
    setToasts((prev) => [...prev, { id: toastId, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 3000);
  };

  // 1. Fetch Document Details
  const fetchDocDetails = async () => {
    try {
      const data = await apiRequest(`/api/documents/${docId}`, { method: 'GET' }, auth);
      setDoc(data.document);
      setPermission(data.permission);
      setTitle(data.document.title);
      return data.document;
    } catch (e) {
      addToast(e.message || 'Error fetching document', 'error');
      navigate('/dashboard');
      throw e;
    }
  };

  // 2. Fetch Version History list
  const fetchVersionHistory = async () => {
    if (!auth.isSignedIn) return;
    setLoadingVersions(true);
    try {
      const data = await apiRequest(`/api/documents/${docId}/versions`, { method: 'GET' }, auth);
      setVersions(data);
    } catch (e) {
      addToast('Error loading version history', 'error');
    } finally {
      setLoadingVersions(false);
    }
  };

  // 3. Create Manual Snapshot
  const handleCreateSnapshot = async (e) => {
    e.preventDefault();
    if (!snapshotTitle.trim()) return;
    setCreatingSnapshot(true);

    try {
      const res = await apiRequest(
        `/api/documents/${docId}/versions`,
        {
          method: 'POST',
          body: JSON.stringify({ title: snapshotTitle }),
        },
        auth
      );
      setVersions((prev) => [res, ...prev]);
      setSnapshotTitle('');
      addToast('Manual snapshot created successfully');
    } catch (e) {
      addToast('Failed to create snapshot', 'error');
    } finally {
      setCreatingSnapshot(false);
    }
  };

  // 4. Restore Version
  const handleRestoreVersion = async (version) => {
    if (window.confirm(`Are you sure you want to restore the document to "${version.title}"?`)) {
      try {
        const res = await apiRequest(
          `/api/documents/${docId}/versions/${version._id}/restore`,
          { method: 'POST' },
          auth
        );
        
        // Update local editor contents
        quillInstance.current.setContents(res.content);
        
        // Broadcast restoration changes to other collaborators
        if (socketRef.current) {
          socketRef.current.emit('send-changes', quillInstance.current.getContents());
        }

        confetti({
          particleCount: 100,
          spread: 80,
        });

        // Exit preview
        setPreviewingVersion(null);
        if (permission !== 'viewer') {
          quillInstance.current.enable(true);
        }

        addToast('Document restored successfully');
        fetchVersionHistory();
      } catch (err) {
        addToast('Failed to restore version', 'error');
      }
    }
  };

  // 5. Enter Version Preview mode
  const handlePreviewVersion = (version) => {
    setPreviewingVersion(version);
    // Set content and disable editing
    quillInstance.current.setContents(version.content);
    quillInstance.current.enable(false);
    addToast(`Previewing version: ${version.title}`);
  };

  // 6. Exit Preview mode
  const handleExitPreview = () => {
    if (!doc) return;
    setPreviewingVersion(null);
    // Reload database content
    quillInstance.current.setContents(doc.content);
    
    // Enable editing if not read-only
    if (permission !== 'viewer') {
      quillInstance.current.enable(true);
    }
    addToast('Exited version preview');
  };

  // 7. Update Document Title
  const handleTitleChange = async (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    if (!newTitle.trim()) return;

    try {
      await apiRequest(
        `/api/documents/${docId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ title: newTitle }),
        },
        auth
      );
      setDoc((prev) => ({ ...prev, title: newTitle }));
    } catch (err) {
      addToast('Failed to update title', 'error');
    }
  };

  // 8. Auto-Save Action
  const performAutoSave = useCallback(() => {
    if (!isDirty || !socketRef.current || !quillInstance.current) return;
    
    setSaveStatus('Saving...');
    const currentContents = quillInstance.current.getContents();

    socketRef.current.emit('save-document', currentContents, (res) => {
      if (res && res.success) {
        setIsDirty(false);
        setSaveStatus('Saved');
      } else {
        setSaveStatus('Error');
        addToast('Auto-save failed. Check connection.', 'error');
      }
    });
  }, [isDirty]);

  // Set up auto save interval (every 2 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      performAutoSave();
    }, 2000);

    return () => clearInterval(interval);
  }, [performAutoSave]);

  // Document Statistics
  const updateStats = (quill) => {
    const text = quill.getText();
    const chars = text.length - 1; // omit Quill trailing newline character
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setCharCount(chars < 0 ? 0 : chars);
    setWordCount(words);
  };

  // 9. Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl + S (Save snapshot manually)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        performAutoSave();
        addToast('Document changes synced to database!');
      }

      // Ctrl + Alt + H (Toggle history sidebar)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setVersionSidebarOpen((prev) => !prev);
      }

      // Escape key (close modals/sidebars)
      if (e.key === 'Escape') {
        setShareModalOpen(false);
        setVersionSidebarOpen(false);
        setKeyboardModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performAutoSave]);

  // 10. Document Initialization
  useEffect(() => {
    let activeDoc = null;

    const initEditor = async () => {
      try {
        activeDoc = await fetchDocDetails();
        
        // Wait for DOM container
        if (!editorRef.current) return;

        // Determine toolbars
        const isEditable = permission !== 'viewer';

        // Setup Quill instance
        const quill = new Quill(editorRef.current, {
          theme: 'snow',
          modules: {
            cursors: true,
            toolbar: isEditable ? [
              [{ font: [] }, { size: [] }],
              ['bold', 'italic', 'underline', 'strike'],
              [{ color: [] }, { background: [] }],
              [{ script: 'sub' }, { script: 'super' }],
              [{ header: '1' }, { header: '2' }, 'blockquote', 'code-block'],
              [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
              [{ direction: 'rtl' }, { align: [] }],
              ['clean'],
            ] : false, // Hide toolbar if read-only
          },
          readOnly: !isEditable,
        });

        quillInstance.current = quill;

        // Load document content
        quill.setContents(activeDoc.content);
        updateStats(quill);
        
        // Bind text-change stats listener
        quill.on('text-change', (delta, oldDelta, source) => {
          updateStats(quill);
          if (source !== 'user') return;
          setIsDirty(true);
          
          // Emit socket update
          if (socketRef.current) {
            socketRef.current.emit('send-changes', delta);
          }
        });

        // Bind selection-change cursor move listener
        quill.on('selection-change', (range) => {
          if (range && socketRef.current) {
            socketRef.current.emit('cursor-move', range);
          }
        });

        // Connect Socket.io client
        const socketServerUrl = import.meta.env.VITE_API_URL || '';
        const socket = io(socketServerUrl, {
          transports: ['websocket'],
          upgrade: false,
        });
        socketRef.current = socket;

        // Socket Connected Event
        socket.on('connect', () => {
          setSaveStatus('Saved');
          // Join the document room
          socket.emit('join-document', {
            docId,
            user: {
              id: auth.user.id,
              name: auth.user.name,
              email: auth.user.email,
              imageUrl: auth.user.imageUrl,
            },
          });
        });

        // Socket Connection Error Handling
        socket.on('disconnect', () => {
          setSaveStatus('Offline');
        });

        socket.on('connect_error', () => {
          setSaveStatus('Offline');
        });

        // Apply external changes from other collaborators
        socket.on('receive-changes', (delta) => {
          quill.updateContents(delta);
        });

        // Real-time cursor movement updates
        socket.on('cursor-update', ({ socketId, name, color, cursor }) => {
          const cursors = quill.getModule('cursors');
          if (cursors) {
            try {
              // Create cursor if missing
              cursors.createCursor(socketId, name, color);
              cursors.moveCursor(socketId, cursor);
            } catch (e) {}
          }
        });

        // Remove collaborator cursor when they disconnect
        socket.on('collaborator-disconnected', (socketId) => {
          const cursors = quill.getModule('cursors');
          if (cursors) {
            try {
              cursors.removeCursor(socketId);
            } catch (e) {}
          }
        });

        // Update list of active room users
        socket.on('collaborators-update', (users) => {
          setCollaborators(users);
        });

        // Reload data if edited externally in a concurrent save
        socket.on('document-updated-externally', () => {
          // Soft toast update or local indicator
        });

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    if (auth.isLoaded) {
      initEditor();
    }

    // Cleanups on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      quillInstance.current = null;
    };
  }, [docId, auth.isLoaded, auth.user?.id, permission]);

  // Export options: TXT, HTML
  const handleExportFile = (type) => {
    if (!quillInstance.current) return;
    
    let content = '';
    let mimeType = 'text/plain';
    let extension = 'txt';

    if (type === 'html') {
      content = quillInstance.current.getSemanticHTML();
      mimeType = 'text/html';
      extension = 'html';
    } else {
      content = quillInstance.current.getText();
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title || 'document'}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast(`Document exported as ${type.toUpperCase()} successfully!`);
  };

  // Sync state if ShareModal edits doc details
  const refreshDocData = (updatedDoc) => {
    setDoc(updatedDoc);
  };

  // Undo / Redo triggers
  const handleUndo = () => {
    if (quillInstance.current) {
      quillInstance.current.history.undo();
    }
  };

  const handleRedo = () => {
    if (quillInstance.current) {
      quillInstance.current.history.redo();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* 1. Preview Mode Header warning */}
      {previewingVersion && (
        <div className="bg-amber-500 text-slate-950 py-2 px-6 flex items-center justify-between text-xs sm:text-sm font-semibold sticky top-0 z-40 shadow-md">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 animate-pulse" />
            <span>
              Previewing historical backup: "{previewingVersion.title}" created on{' '}
              {new Date(previewingVersion.createdAt).toLocaleString()} by{' '}
              {previewingVersion.createdByName}.
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleExitPreview}
              className="bg-white/20 hover:bg-white/30 text-slate-950 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Exit Preview
            </button>
            
            {permission !== 'viewer' && (
              <button
                onClick={() => handleRestoreVersion(previewingVersion)}
                className="bg-slate-950 text-white hover:bg-slate-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Restore Version
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Page Navigation & Tools Header Bar */}
      <header className="p-3 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
        
        {/* Left Side: Navigation Back & Title */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-400 cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <input
                ref={titleInputRef}
                type="text"
                disabled={permission === 'viewer' || !!previewingVersion}
                value={title}
                onChange={handleTitleChange}
                className="font-display font-bold text-sm sm:text-base bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-800 focus:border-blue-500 focus:outline-none transition-all py-0.5 max-w-[200px] sm:max-w-[400px] w-full truncate"
              />
              
              {/* Save status badge */}
              <div className="flex items-center gap-1 shrink-0 select-none">
                {saveStatus === 'Saving...' && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-500 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">Saving...</span>
                  </div>
                )}
                {saveStatus === 'Saved' && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold" title="All edits saved locally">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="hidden sm:inline">Saved</span>
                  </div>
                )}
                {saveStatus === 'Offline' && (
                  <div className="flex items-center gap-1 text-[10px] text-red-500 font-semibold">
                    <CloudOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Offline</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick action buttons */}
            {permission !== 'viewer' && !previewingVersion && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium mt-0.5">
                <button onClick={handleUndo} className="hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer"><Undo2 className="w-3 h-3" /></button>
                <button onClick={handleRedo} className="hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded cursor-pointer mr-2"><Redo2 className="w-3 h-3" /></button>
                <span className="hidden sm:inline">| Press</span>
                <kbd className="px-1 bg-slate-100 dark:bg-slate-800 rounded mx-0.5 text-[9px]">Ctrl+S</kbd>
                <span className="hidden sm:inline">to sync</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Presence, Collaborators, and actions buttons */}
        <div className="flex items-center gap-3.5">
          
          {/* Active Collaborators Avatars */}
          <div className="flex items-center -space-x-2 shrink-0">
            {collaborators.slice(0, 4).map((col, idx) => (
              <div
                key={idx}
                className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 flex items-center justify-center overflow-hidden"
                style={{ borderColor: col.color }}
                title={`${col.name} (${col.email})`}
              >
                {col.imageUrl ? (
                  <img src={col.imageUrl} alt={col.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] font-bold uppercase">{col.name.slice(0, 2)}</span>
                )}
              </div>
            ))}
            {collaborators.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold shrink-0">
                +{collaborators.length - 4}
              </div>
            )}
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 shrink-0"></div>

          {/* Export Dropdown menu */}
          <div className="relative group">
            <button className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-855 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer flex items-center gap-1.5 text-xs font-semibold">
              <FileDown className="w-4.5 h-4.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <div className="absolute right-0 mt-1 w-28 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 shadow-lg py-1 z-35 invisible group-hover:visible group-focus-within:visible animate-fade-in text-xs font-medium">
              <button onClick={() => handleExportFile('txt')} className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer">Plain Text</button>
              <button onClick={() => handleExportFile('html')} className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer">HTML Web</button>
            </div>
          </div>

          {/* Version History Button */}
          {auth.isSignedIn && (
            <button
              onClick={() => {
                setVersionSidebarOpen(true);
                fetchVersionHistory();
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Version History (Ctrl+Alt+H)"
            >
              <History className="w-4.5 h-4.5" />
              <span className="hidden sm:inline">History</span>
            </button>
          )}

          {/* Share Button (Only for Owners/Editors) */}
          {auth.isSignedIn && (permission === 'owner' || permission === 'editor') && (
            <button
              onClick={() => setShareModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-850 dark:hover:text-slate-200 cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 3. Editor Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Core Editor Container Area */}
        <main className="flex-1 overflow-y-auto flex flex-col items-center p-4 sm:p-8 relative">
          
          {loading ? (
            <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 z-20">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              <p className="text-slate-500 dark:text-slate-400 font-medium text-xs">Opening canvas...</p>
            </div>
          ) : null}

          {/* Paper Canvas wrapper */}
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/50 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col min-h-[85vh] relative overflow-hidden">
            
            {/* If user is only a viewer, show badge */}
            {permission === 'viewer' && (
              <div className="p-3 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2 font-medium justify-center select-none">
                <Eye className="w-4.5 h-4.5 text-blue-500" />
                <span>You are in **Read-only** mode. Sharing settings prevent editing.</span>
              </div>
            )}

            {/* Quill editor div */}
            <div id="editor-container" ref={editorRef} className="flex-1 flex flex-col p-8 sm:p-12 dark:text-slate-100 prose dark:prose-invert max-w-none focus:outline-none"></div>
          </div>
        </main>

        {/* 4. Side Statistics Panel */}
        {statsPanelOpen && !loading && (
          <aside className="w-56 border-l border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md p-5 flex flex-col gap-6 hidden lg:flex select-none">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-500" />
              <span>Document Details</span>
            </h4>
            
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 flex flex-col gap-1 shadow-inner">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Words count</span>
                <span className="font-display font-extrabold text-2xl bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">{wordCount}</span>
              </div>
              
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 flex flex-col gap-1 shadow-inner">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Characters count</span>
                <span className="font-display font-extrabold text-2xl bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">{charCount}</span>
              </div>
            </div>

            <div className="mt-auto border-t border-slate-200/50 dark:border-slate-800/50 pt-4 flex flex-col gap-3">
              <button 
                onClick={() => setKeyboardModalOpen(true)}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-150 dark:hover:bg-slate-850 transition-colors text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Keyboard className="w-4 h-4" />
                <span>Shortcuts</span>
              </button>
            </div>
          </aside>
        )}

        {/* 5. Version History Sidebar */}
        {versionSidebarOpen && (
          <aside className="w-80 border-l border-slate-200/60 dark:border-slate-800/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-6 flex flex-col gap-6 absolute right-0 top-0 bottom-0 z-40 shadow-2xl animate-slide-in">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <History className="w-5 h-5" />
                <h3 className="font-display font-bold text-base">Version Snapshots</h3>
              </div>
              <button
                onClick={() => {
                  if (previewingVersion) handleExitPreview();
                  setVersionSidebarOpen(false);
                }}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Save snapshot form (only for editors) */}
            {permission !== 'viewer' && !previewingVersion && (
              <form onSubmit={handleCreateSnapshot} className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Snapshot Name</label>
                  <input
                    type="text"
                    required
                    value={snapshotTitle}
                    onChange={(e) => setSnapshotTitle(e.target.value)}
                    placeholder="e.g. Milestone V1, Meeting note..."
                    className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingSnapshot}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-blue-400"
                >
                  {creatingSnapshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Save Snapshot</span>
                </button>
              </form>
            )}

            {/* Snapshots Scroll list */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saved Backups</span>
              
              {loadingVersions ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : versions.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">No version backups created yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {versions.map((ver) => (
                    <div
                      key={ver._id}
                      onClick={() => handlePreviewVersion(ver)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        previewingVersion?._id === ver._id
                          ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm'
                          : 'border-slate-200/60 dark:border-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-850 bg-white/40 dark:bg-slate-950/20'
                      }`}
                    >
                      <p className="text-xs font-bold truncate leading-tight group-hover:text-blue-500">
                        {ver.title}
                      </p>
                      
                      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 mt-2">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(ver.createdAt).toLocaleString()}</span>
                      </div>
                      
                      <p className="text-[9px] text-slate-500 mt-1 font-medium">
                        By {ver.createdByName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* 6. Share Modal Dialog */}
      {doc && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          doc={doc}
          auth={auth}
          addToast={addToast}
          onRefreshDoc={refreshDocData}
        />
      )}

      {/* 7. Keyboard Shortcuts dialog */}
      {keyboardModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Keyboard className="w-5 h-5" />
              <h3 className="font-display font-bold text-lg">Keyboard Shortcuts</h3>
            </div>
            
            <div className="flex flex-col gap-3 py-2 text-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>Save snapshot manually</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold">Ctrl + S</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>Toggle version history sidebar</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold">Ctrl + Alt + H</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>Undo latest change</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold">Ctrl + Z</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>Redo latest change</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold">Ctrl + Y</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Close dialogs / menus</span>
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded text-xs font-bold">Esc</kbd>
              </div>
            </div>

            <button
              onClick={() => setKeyboardModalOpen(false)}
              className="mt-2 w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-850 font-semibold text-xs transition-colors cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Stacks */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-3 animate-slide-in ${
              toast.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-650 dark:text-red-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200'
            }`}
          >
            {toast.type === 'error' ? (
              <CloudOff className="w-5 h-5 shrink-0 text-red-500" />
            ) : (
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" />
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
