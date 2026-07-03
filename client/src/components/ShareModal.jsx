import React, { useState } from 'react';
import { 
  X, 
  Globe, 
  Lock, 
  Link, 
  UserPlus, 
  Check, 
  Trash2,
  Shield,
  Loader
} from 'lucide-react';
import { apiRequest } from '../utils/api';

export default function ShareModal({ isOpen, onClose, doc, auth, addToast, onRefreshDoc }) {
  const [isPublic, setIsPublic] = useState(doc.isPublic);
  const [globalPermission, setGlobalPermission] = useState(doc.globalPermission);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [sharingLoading, setSharingLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  if (!isOpen) return null;

  const handleTogglePublic = async (checked) => {
    setSharingLoading(true);
    try {
      const updated = await apiRequest(
        `/api/documents/${doc._id}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ isPublic: checked }),
        },
        auth
      );
      setIsPublic(updated.isPublic);
      onRefreshDoc(updated);
      addToast(checked ? 'Anyone with the link can now access' : 'Document access restricted');
    } catch (e) {
      addToast(e.message || 'Failed to update sharing mode', 'error');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleGlobalPermissionChange = async (perm) => {
    setSharingLoading(true);
    try {
      const updated = await apiRequest(
        `/api/documents/${doc._id}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ globalPermission: perm }),
        },
        auth
      );
      setGlobalPermission(updated.globalPermission);
      onRefreshDoc(updated);
      addToast(`Link permissions updated to ${perm}`);
    } catch (e) {
      addToast(e.message || 'Failed to update link permissions', 'error');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleAddCollaborator = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);

    try {
      const updated = await apiRequest(
        `/api/documents/${doc._id}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ 
            email: inviteEmail.trim(), 
            permission: inviteRole 
          }),
        },
        auth
      );
      onRefreshDoc(updated);
      setInviteEmail('');
      addToast(`Added ${inviteEmail} as collaborator`);
    } catch (e) {
      addToast(e.message || 'Failed to add collaborator', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveCollaborator = async (colUserId, colEmail) => {
    setSharingLoading(true);
    try {
      const updated = await apiRequest(
        `/api/documents/${doc._id}/share`,
        {
          method: 'POST',
          body: JSON.stringify({ 
            email: colEmail, 
            permission: 'none' 
          }),
        },
        auth
      );
      onRefreshDoc(updated);
      addToast('Collaborator removed');
    } catch (e) {
      addToast('Failed to remove collaborator', 'error');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast('Document share link copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between bg-slate-50 dark:bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-display font-bold text-lg">Document Share Settings</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          
          {/* Section: General Link Access */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              General Link Access
            </h4>

            <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-850">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 shrink-0">
                  {isPublic ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {isPublic ? 'Anyone with the link' : 'Restricted'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {isPublic 
                      ? 'Anyone on the internet with this URL can access this document.' 
                      : 'Only explicitly added collaborators can open this document.'}
                  </p>
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center">
                {sharingLoading ? (
                  <Loader className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => handleTogglePublic(e.target.checked)}
                    className="w-10 h-5 bg-slate-200 dark:bg-slate-800 rounded-full appearance-none relative checked:bg-blue-600 transition-colors duration-250 cursor-pointer before:content-[''] before:w-4 before:h-4 before:bg-white before:rounded-full before:absolute before:top-0.5 before:left-0.5 before:transition-transform checked:before:translate-x-5"
                  />
                )}
              </div>
            </div>

            {/* If public, select access role */}
            {isPublic && (
              <div className="flex items-center justify-between text-xs p-3 px-4 rounded-xl border border-slate-150 dark:border-slate-850 bg-white dark:bg-slate-900">
                <span className="font-semibold text-slate-500">Public Link Access Level:</span>
                <select
                  value={globalPermission}
                  onChange={(e) => handleGlobalPermissionChange(e.target.value)}
                  className="bg-transparent border-none py-1 pl-2 pr-6 font-semibold focus:outline-none text-blue-500 cursor-pointer"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="commenter">Commenter</option>
                  <option value="editor">Editor (Can type)</option>
                </select>
              </div>
            )}
          </div>

          {/* Section: Add Collaborators */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Add Collaborators
            </h4>

            <form onSubmit={handleAddCollaborator} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="email"
                  required
                  placeholder="Invite user by email address..."
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl pl-4 pr-24 py-3 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent text-[11px] font-semibold text-slate-450 border-none focus:outline-none py-1 pr-4 cursor-pointer"
                >
                  <option value="editor">Editor</option>
                  <option value="commenter">Commenter</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviteLoading}
                className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white text-xs font-semibold shadow-md shadow-blue-600/10 hover:shadow-blue-600/20 transition-all cursor-pointer flex items-center justify-center shrink-0 min-w-[70px]"
              >
                {inviteLoading ? <Loader className="w-4.5 h-4.5 animate-spin" /> : <UserPlus className="w-4.5 h-4.5" />}
              </button>
            </form>
          </div>

          {/* Section: Current Collaborators list */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Who has access
            </h4>

            <div className="divide-y divide-slate-150 dark:divide-slate-850 flex flex-col">
              {/* Owner Item */}
              <div className="py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <img
                    src={doc.ownerImageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=50&h=50&q=80'}
                    alt="owner"
                    className="w-7 h-7 rounded-full object-cover bg-slate-100"
                  />
                  <div>
                    <p className="font-semibold">{doc.ownerName} <span className="text-[10px] text-slate-400 font-normal">(Owner)</span></p>
                    <p className="text-[10px] text-slate-400">{doc.ownerEmail}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-400 px-3">Owner</span>
              </div>

              {/* Collaborators list */}
              {doc.collaborators.map((col) => (
                <div key={col.userId} className="py-2.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={col.imageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=50&h=50&q=80'}
                      alt={col.name}
                      className="w-7 h-7 rounded-full object-cover bg-slate-100"
                    />
                    <div>
                      <p className="font-semibold">{col.name}</p>
                      <p className="text-[10px] text-slate-400">{col.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-450 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 select-none">
                      {col.permission.charAt(0).toUpperCase() + col.permission.slice(1)}
                    </span>
                    <button
                      onClick={() => handleRemoveCollaborator(col.userId, col.email)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-colors"
                      title="Remove Collaborator"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer actions */}
        <div className="p-5 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between">
          <button
            onClick={handleCopyLink}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-semibold hover:bg-slate-150 dark:hover:bg-slate-850 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Link className="w-4 h-4 text-blue-500" />
            <span>Copy Link</span>
          </button>
          
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/10 transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
