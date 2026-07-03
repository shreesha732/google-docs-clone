import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiRequest } from '../utils/api';
import {
  FileText,
  Search,
  Grid,
  List,
  ChevronDown,
  MoreVertical,
  Star,
  Plus,
  Calendar,
  Rocket,
  Mail,
  User,
  LogOut,
  FolderOpen,
  Trash2,
  Undo,
  Sun,
  Moon,
  Clock,
  ExternalLink,
  Edit2,
  Copy,
  AlertTriangle,
  FolderDot
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Dashboard() {
  const auth = useAppAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // State Management
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'owned' | 'shared' | 'starred' | 'trash'
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('updated-desc'); // 'updated-desc' | 'created-desc' | 'title-asc' | 'title-desc'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  // Modals & Menu Actions
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [renamingDoc, setRenamingDoc] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const menuRef = useRef(null);

  // Fetch Documents
  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const endpoint = `/api/documents?filter=${filter}&search=${search}&sort=${sort}`;
      const data = await apiRequest(endpoint, { method: 'GET' }, auth);
      setDocuments(data);
    } catch (err) {
      addToast(err.message || 'Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [filter, sort, auth.getToken]);

  // Debounced search trigger
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchDocuments();
    }, 400);
    return () => clearTimeout(delay);
  }, [search]);

  // Click outside menu closer
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Toast notifications helper
  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  // Create Document from Template
  const handleCreateDocument = async (templateName) => {
    try {
      const res = await apiRequest(
        '/api/documents',
        {
          method: 'POST',
          body: JSON.stringify({ template: templateName }),
        },
        auth
      );
      
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      addToast(`Document created from ${templateName} template!`);
      setTimeout(() => {
        navigate(`/documents/${res._id}`);
      }, 500);
    } catch (err) {
      addToast(err.message || 'Error creating document', 'error');
    }
  };

  // Star / Unstar Document
  const handleStarDocument = async (docId, e) => {
    e.stopPropagation();
    try {
      const updated = await apiRequest(`/api/documents/${docId}/star`, { method: 'POST' }, auth);
      setDocuments((prev) =>
        prev.map((d) => (d._id === docId ? { ...d, isStarred: updated.isStarred } : d))
      );
      addToast(updated.isStarred ? 'Added to Starred' : 'Removed from Starred');
      // If we are currently in Starred filter, update document list
      if (filter === 'starred') {
        setDocuments((prev) => prev.filter((d) => d._id !== docId));
      }
    } catch (err) {
      addToast('Error starring document', 'error');
    }
    setActiveMenuId(null);
  };

  // Duplicate Document
  const handleDuplicateDocument = async (docId, e) => {
    e.stopPropagation();
    try {
      const newDoc = await apiRequest(`/api/documents/${docId}/duplicate`, { method: 'POST' }, auth);
      setDocuments((prev) => [newDoc, ...prev]);
      addToast('Document duplicated successfully');
    } catch (err) {
      addToast('Error duplicating document', 'error');
    }
    setActiveMenuId(null);
  };

  // Delete / Trash Document
  const handleDeleteDocument = async (docId, isPermanent, e) => {
    e.stopPropagation();
    try {
      await apiRequest(`/api/documents/${docId}`, { method: 'DELETE' }, auth);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      
      addToast(isPermanent ? 'Document permanently deleted' : 'Document moved to trash');
    } catch (err) {
      addToast('Error deleting document', 'error');
    }
    setActiveMenuId(null);
  };

  // Restore Document from Trash
  const handleRestoreDocument = async (docId, e) => {
    e.stopPropagation();
    try {
      await apiRequest(`/api/documents/${docId}/restore`, { method: 'POST' }, auth);
      setDocuments((prev) => prev.filter((d) => d._id !== docId));
      addToast('Document restored successfully');
    } catch (err) {
      addToast('Error restoring document', 'error');
    }
    setActiveMenuId(null);
  };

  // Rename Document trigger
  const triggerRename = (doc, e) => {
    e.stopPropagation();
    setRenamingDoc(doc);
    setNewTitle(doc.title);
    setActiveMenuId(null);
  };

  // Save renamed document
  const submitRename = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await apiRequest(
        `/api/documents/${renamingDoc._id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ title: newTitle }),
        },
        auth
      );
      setDocuments((prev) =>
        prev.map((d) => (d._id === renamingDoc._id ? { ...d, title: newTitle } : d))
      );
      addToast('Document renamed successfully');
      setRenamingDoc(null);
    } catch (err) {
      addToast('Error renaming document', 'error');
    }
  };

  const getTemplateIcon = (name) => {
    switch (name) {
      case 'resume':
        return <User className="w-5 h-5 text-indigo-500" />;
      case 'meeting-notes':
        return <Calendar className="w-5 h-5 text-emerald-500" />;
      case 'project-proposal':
        return <Rocket className="w-5 h-5 text-rose-500" />;
      case 'letter':
        return <Mail className="w-5 h-5 text-amber-500" />;
      default:
        return <Plus className="w-6 h-6 text-blue-500" />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md flex flex-col hidden md:flex">
        {/* Sidebar Header Logo */}
        <div className="p-6 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <FileText className="w-4.5 h-4.5" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
            DocStudio
          </span>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="p-4 flex-1 flex flex-col gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>All Documents</span>
          </button>

          <button
            onClick={() => setFilter('owned')}
            className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              filter === 'owned'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
            }`}
          >
            <FolderDot className="w-4 h-4" />
            <span>Owned by Me</span>
          </button>

          <button
            onClick={() => setFilter('shared')}
            className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              filter === 'shared'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Shared with Me</span>
          </button>

          <button
            onClick={() => setFilter('starred')}
            className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              filter === 'starred'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Starred</span>
          </button>

          <div className="my-2 border-t border-slate-200/50 dark:border-slate-800/50"></div>

          <button
            onClick={() => setFilter('trash')}
            className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-colors cursor-pointer ${
              filter === 'trash'
                ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Trash Bin</span>
          </button>
        </nav>

        {/* Sidebar Footer User Info */}
        <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src={auth.user?.imageUrl}
              alt="Profile"
              className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 object-cover"
            />
            <div className="max-w-[120px]">
              <p className="text-xs font-semibold truncate leading-tight">{auth.user?.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{auth.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </aside>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        
        {/* Top Navbar Header */}
        <header className="p-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1">
            {/* Search Input Box */}
            <div className="relative max-w-md w-full">
              <Search className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search documents by title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400 cursor-pointer"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Mobile Sidebar Navigation Menu */}
            <div className="flex md:hidden items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-xs bg-slate-100 dark:bg-slate-900 border-none rounded-xl px-3 py-2 focus:outline-none font-medium cursor-pointer"
              >
                <option value="all">All Docs</option>
                <option value="owned">Owned</option>
                <option value="shared">Shared</option>
                <option value="starred">Starred</option>
                <option value="trash">Trash</option>
              </select>
              <button
                onClick={() => auth.signOut()}
                className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Content Container */}
        <div className="max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8 flex-1">
          
          {/* Templates Section - Skip when in trash tab */}
          {filter !== 'trash' && (
            <section className="flex flex-col gap-4">
              <h2 className="font-display font-semibold text-base text-slate-500 dark:text-slate-400 tracking-wide uppercase">
                Create a New Document
              </h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {[
                  { name: 'blank', label: 'Blank Doc', desc: 'Start fresh' },
                  { name: 'resume', label: 'Resume', desc: 'Portfolio & Job' },
                  { name: 'meeting-notes', label: 'Meeting Notes', desc: 'Sync agenda' },
                  { name: 'project-proposal', label: 'Proposal', desc: 'Pitch new ideas' },
                  { name: 'letter', label: 'Letter', desc: 'Formal message' },
                ].map((temp) => (
                  <button
                    key={temp.name}
                    onClick={() => handleCreateDocument(temp.name)}
                    className="flex flex-col items-center justify-center p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900/40 text-center transition-all hover:translate-y-[-3px] hover:shadow-md hover:border-blue-500/50 dark:hover:border-blue-500/50 group cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 transition-colors mb-3">
                      {getTemplateIcon(temp.name)}
                    </div>
                    <span className="text-sm font-semibold mb-1 block group-hover:text-blue-500 transition-colors">
                      {temp.label}
                    </span>
                    <span className="text-[10px] text-slate-400">{temp.desc}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Documents Lists Section */}
          <section className="flex flex-col gap-4 flex-1">
            
            {/* List Filters header options */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-xl">
                  {filter === 'all' && 'All Documents'}
                  {filter === 'owned' && 'My Documents'}
                  {filter === 'shared' && 'Shared with Me'}
                  {filter === 'starred' && 'Starred'}
                  {filter === 'trash' && 'Trash Bin'}
                </span>
                <span className="text-xs bg-slate-150 dark:bg-slate-800 px-2 py-0.5 rounded-full font-semibold text-slate-500">
                  {documents.length}
                </span>
              </div>

              {/* View options / Sorting controls */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative">
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 pr-8 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="updated-desc">Last Modified</option>
                    <option value="created-desc">Date Created</option>
                    <option value="title-asc">Title (A - Z)</option>
                    <option value="title-desc">Title (Z - A)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Documents display block */}
            {loading ? (
              // Loading skeletons
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6' : 'flex flex-col gap-3'}>
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={`bg-white dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col gap-3 animate-pulse ${
                      viewMode === 'list' ? 'flex-row items-center justify-between' : ''
                    }`}
                  >
                    <div className="w-10 h-12 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-[60%]"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-[40%]"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : documents.length === 0 ? (
              // Empty State Illustration
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 py-20 bg-white/40 dark:bg-slate-900/10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 max-w-xl mx-auto w-full">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 mb-6 shadow-inner">
                  <FolderDot className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">No documents found</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                  {search 
                    ? `We couldn't find any documents matching "${search}".` 
                    : `No documents available in this folder. Create a new document to get started.`}
                </p>
                {filter !== 'trash' && !search && (
                  <button
                    onClick={() => handleCreateDocument('blank')}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Document</span>
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              // Grid View layout
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {documents.map((doc) => (
                  <div
                    key={doc._id}
                    onClick={() => navigate(`/documents/${doc._id}`)}
                    className="bg-white dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 flex flex-col justify-between gap-5 transition-all shadow-sm hover:shadow-md cursor-pointer hover:border-slate-350 dark:hover:border-slate-750 group relative"
                  >
                    {/* Document Icon & Star */}
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-12 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-100/50 dark:border-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform duration-200">
                        <FileText className="w-5.5 h-5.5" />
                      </div>
                      
                      {/* Star indicator */}
                      <div className="flex items-center gap-1">
                        {doc.isStarred && (
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        )}
                        
                        {/* Options button */}
                        <div className="relative" ref={activeMenuId === doc._id ? menuRef : null}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === doc._id ? null : doc._id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <MoreVertical className="w-4.5 h-4.5" />
                          </button>

                          {/* Menu Popup */}
                          {activeMenuId === doc._id && (
                            <div className="absolute right-0 mt-1 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-35 animate-fade-in">
                              {filter === 'trash' ? (
                                <>
                                  <button
                                    onClick={(e) => handleRestoreDocument(doc._id, e)}
                                    className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                  >
                                    <Undo className="w-4 h-4" />
                                    <span>Restore Document</span>
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteDocument(doc._id, true, e)}
                                    className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 text-red-650 dark:text-red-400 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete Permanently</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => handleStarDocument(doc._id, e)}
                                    className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Star className={`w-4 h-4 ${doc.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                                    <span>{doc.isStarred ? 'Unstar' : 'Star'}</span>
                                  </button>
                                  <button
                                    onClick={(e) => triggerRename(doc, e)}
                                    className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit2 className="w-4 h-4 text-slate-400" />
                                    <span>Rename</span>
                                  </button>
                                  <button
                                    onClick={(e) => handleDuplicateDocument(doc._id, e)}
                                    className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 cursor-pointer"
                                  >
                                    <Copy className="w-4 h-4 text-slate-400" />
                                    <span>Duplicate</span>
                                  </button>
                                  <div className="my-1 border-t border-slate-150 dark:border-slate-800"></div>
                                  <button
                                    onClick={(e) => handleDeleteDocument(doc._id, false, e)}
                                    className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 text-red-600 dark:text-red-400 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Move to Trash</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Title & Modified dates */}
                    <div className="flex flex-col gap-1.5">
                      <span className="font-semibold text-sm leading-tight block truncate group-hover:text-blue-500 transition-colors">
                        {doc.title}
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                        <Clock className="w-3 h-3" />
                        <span>
                          Saved {new Date(doc.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // List View layout
              <div className="flex flex-col border border-slate-200/50 dark:border-slate-800/50 rounded-2xl bg-white dark:bg-slate-900/20 overflow-hidden">
                <div className="grid grid-cols-12 px-6 py-3 bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-200/50 dark:border-slate-800/50">
                  <div className="col-span-6">Name</div>
                  <div className="col-span-3">Owner</div>
                  <div className="col-span-2">Last Modified</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                <div className="divide-y divide-slate-150 dark:divide-slate-850">
                  {documents.map((doc) => (
                    <div
                      key={doc._id}
                      onClick={() => navigate(`/documents/${doc._id}`)}
                      className="grid grid-cols-12 px-6 py-4 items-center hover:bg-slate-50/50 dark:hover:bg-slate-850/30 cursor-pointer transition-colors text-sm"
                    >
                      <div className="col-span-6 flex items-center gap-3">
                        <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                        <span className="font-semibold truncate pr-4">{doc.title}</span>
                        {doc.isStarred && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                      </div>

                      <div className="col-span-3 flex items-center gap-2">
                        {doc.ownerImageUrl ? (
                          <img src={doc.ownerImageUrl} alt="owner" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold">U</div>
                        )}
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{doc.ownerName}</span>
                      </div>

                      <div className="col-span-2 text-xs text-slate-400">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </div>

                      <div className="col-span-1 text-right flex justify-end relative" ref={activeMenuId === doc._id ? menuRef : null}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(activeMenuId === doc._id ? null : doc._id);
                          }}
                          className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* List dropdown menu options */}
                        {activeMenuId === doc._id && (
                          <div className="absolute right-0 mt-7 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-35 animate-fade-in">
                            {filter === 'trash' ? (
                              <>
                                <button
                                  onClick={(e) => handleRestoreDocument(doc._id, e)}
                                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                                >
                                  <Undo className="w-4 h-4" />
                                  <span>Restore Document</span>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteDocument(doc._id, true, e)}
                                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 text-red-650 dark:text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Delete Permanently</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => handleStarDocument(doc._id, e)}
                                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 cursor-pointer"
                                >
                                  <Star className={`w-4 h-4 ${doc.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                                  <span>{doc.isStarred ? 'Unstar' : 'Star'}</span>
                                </button>
                                <button
                                  onClick={(e) => triggerRename(doc, e)}
                                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4 text-slate-400" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  onClick={(e) => handleDuplicateDocument(doc._id, e)}
                                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 cursor-pointer"
                                >
                                  <Copy className="w-4 h-4 text-slate-400" />
                                  <span>Duplicate</span>
                                </button>
                                <div className="my-1 border-t border-slate-150 dark:border-slate-800"></div>
                                <button
                                  onClick={(e) => handleDeleteDocument(doc._id, false, e)}
                                  className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-850 flex items-center gap-2 text-red-650 dark:text-red-400 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Move to Trash</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Rename Document Dialog Overlay Modal */}
      {renamingDoc && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <form
            onSubmit={submitRename}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Edit2 className="w-5 h-5" />
              <h3 className="font-display font-bold text-lg">Rename Document</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-semibold uppercase">New Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                placeholder="Enter title..."
              />
            </div>

            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setRenamingDoc(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/10 transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
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
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-500" />
            ) : (
              <FileText className="w-5 h-5 shrink-0 text-blue-500" />
            )}
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
