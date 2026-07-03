import { nanoid } from 'nanoid';

// In-Memory Database store for demo mode
class InMemoryDatabase {
  constructor() {
    this.documents = [];
    this.versions = [];
  }

  // Pre-seed some templates/demo content
  seed(userId, userName, userEmail, userImageUrl) {
    if (this.documents.length > 0) return;

    const welcomeDoc = {
      _id: 'welcome-doc-123',
      title: 'Welcome to DocStudio 🚀',
      content: {
        ops: [
          { insert: 'Welcome to DocStudio!\n', attributes: { header: 1, align: 'center' } },
          { insert: 'This document is running in Demo Mode using an in-memory database on the Node.js server. No MongoDB installation is active.\n\n', attributes: { italic: true } },
          { insert: 'Features you can test right now:\n', attributes: { bold: true } },
          { insert: '• Real-time typing & editing in this Quill rich text canvas.\n' },
          { insert: '• Word and character counts update dynamically in the right sidebar.\n' },
          { insert: '• Create custom snapshots and preview/restore versions in the History tab.\n' },
          { insert: '• Click Share at the top right to invite mock users or make the document public.\n' },
          { insert: '• Open another browser window (or incognito tab) with this link to see real-time cursor tracking and simultaneous editing presence!\n' }
        ]
      },
      ownerId: userId,
      ownerName: userName,
      ownerEmail: userEmail,
      ownerImageUrl: userImageUrl,
      isStarred: true,
      isTrashed: false,
      isPublic: true,
      globalPermission: 'editor',
      collaborators: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.documents.push(welcomeDoc);
    
    this.versions.push({
      _id: nanoid(12),
      documentId: welcomeDoc._id,
      content: welcomeDoc.content,
      title: 'Welcome Baseline',
      createdById: userId,
      createdByName: userName,
      createdAt: new Date()
    });
  }

  // Find documents based on filters, search, and sort
  findDocuments({ filter, search, sort, userId }) {
    let list = this.documents;

    // Filter by trash state
    if (filter === 'trash') {
      list = list.filter(d => d.isTrashed && (d.ownerId === userId || d.collaborators.some(c => c.userId === userId)));
    } else {
      list = list.filter(d => !d.isTrashed);
      
      if (filter === 'owned') {
        list = list.filter(d => d.ownerId === userId);
      } else if (filter === 'shared') {
        list = list.filter(d => d.ownerId !== userId && d.collaborators.some(c => c.userId === userId));
      } else if (filter === 'starred') {
        list = list.filter(d => d.isStarred && (d.ownerId === userId || d.collaborators.some(c => c.userId === userId)));
      } else {
        // all active documents
        list = list.filter(d => d.ownerId === userId || d.collaborators.some(c => c.userId === userId));
      }
    }

    // Filter by search query
    if (search && search.trim() !== '') {
      const q = search.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q));
    }

    // Sort documents
    list = [...list].sort((a, b) => {
      if (sort === 'title-asc') return a.title.localeCompare(b.title);
      if (sort === 'title-desc') return b.title.localeCompare(a.title);
      if (sort === 'created-desc') return new Date(b.createdAt) - new Date(a.createdAt);
      return new Date(b.updatedAt) - new Date(a.updatedAt); // default: updated-desc
    });

    return list;
  }

  // Find single document
  findDocumentById(id) {
    return this.documents.find(d => d._id === id) || null;
  }

  // Create new document
  createDocument({ title, content, ownerId, ownerName, ownerEmail, ownerImageUrl }) {
    const doc = {
      _id: nanoid(12),
      title,
      content,
      ownerId,
      ownerName,
      ownerEmail,
      ownerImageUrl,
      isStarred: false,
      isTrashed: false,
      isPublic: false,
      globalPermission: 'none',
      collaborators: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.documents.push(doc);
    return doc;
  }

  // Update document metadata
  updateDocument(id, updates) {
    const idx = this.documents.findIndex(d => d._id === id);
    if (idx === -1) return null;

    this.documents[idx] = {
      ...this.documents[idx],
      ...updates,
      updatedAt: new Date()
    };
    return this.documents[idx];
  }

  // Delete document (soft/hard)
  deleteDocument(id, isPermanent = false) {
    const idx = this.documents.findIndex(d => d._id === id);
    if (idx === -1) return false;

    if (!isPermanent && !this.documents[idx].isTrashed) {
      // Soft delete
      this.documents[idx].isTrashed = true;
      this.documents[idx].updatedAt = new Date();
      return { isTrashed: true, doc: this.documents[idx] };
    } else {
      // Permanent delete
      this.documents.splice(idx, 1);
      // Remove associated versions
      this.versions = this.versions.filter(v => v.documentId !== id);
      return { isDeleted: true };
    }
  }

  // Restore document from trash
  restoreDocument(id) {
    const doc = this.findDocumentById(id);
    if (!doc) return null;
    doc.isTrashed = false;
    doc.updatedAt = new Date();
    return doc;
  }

  // Fetch version snapshots
  findVersionsByDocumentId(documentId) {
    return this.versions
      .filter(v => v.documentId === documentId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // Find version
  findVersionById(versionId, documentId) {
    return this.versions.find(v => v._id === versionId && v.documentId === documentId) || null;
  }

  // Create version snapshot
  createVersion({ documentId, content, title, createdById, createdByName }) {
    const version = {
      _id: nanoid(12),
      documentId,
      content,
      title,
      createdById,
      createdByName,
      createdAt: new Date()
    };
    this.versions.push(version);
    return version;
  }
}

export const inMemoryDb = new InMemoryDatabase();
export default inMemoryDb;
