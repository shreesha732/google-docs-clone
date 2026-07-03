import express from 'express';
import { createClerkClient } from '@clerk/backend';
import { env } from '../config/env.js';
import { Document } from '../models/Document.js';
import { Version } from '../models/Version.js';
import { inMemoryDb } from '../config/inMemoryDb.js';
import { requireAuth, optionalAuth } from '../middleware/authMiddleware.js';
import { APIError } from '../middleware/errorMiddleware.js';

const router = express.Router();

// Initialize clerk only if not in demo mode
const clerk = env.IS_DEMO_MODE ? null : createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Template delta map
const templates = {
  blank: { ops: [{ insert: '\n' }] },
  resume: {
    ops: [
      { insert: 'YOUR NAME\n', attributes: { header: 1, align: 'center' } },
      { insert: 'Software Engineer  |  email@example.com  |  (123) 456-7890  |  github.com/username\n', attributes: { align: 'center' } },
      { insert: '\nEXPERIENCE\n', attributes: { header: 2 } },
      { insert: 'Software Engineer Intern', attributes: { bold: true } },
      { insert: ' — Tech Company (2025 - Present)\n' },
      { insert: '• Developed a real-time collaborative text editor using React and Socket.io.\n• Optimised database queries, reducing response times by 30%.\n' },
      { insert: '\nEDUCATION\n', attributes: { header: 2 } },
      { insert: 'B.S. in Computer Science', attributes: { bold: true } },
      { insert: ' — University (Graduated 2026)\n' }
    ]
  },
  'meeting-notes': {
    ops: [
      { insert: 'Weekly Team Sync\n', attributes: { header: 1 } },
      { insert: 'Date: ', attributes: { bold: true } },
      { insert: 'July 2, 2026\n' },
      { insert: 'Attendees: ', attributes: { bold: true } },
      { insert: 'John Doe, Jane Smith, Alex Rivera\n\n' },
      { insert: 'Agenda\n', attributes: { header: 2 } },
      { insert: '1. Project updates\n2. Q3 Planning\n3. Technical blockers\n\n' },
      { insert: 'Action Items\n', attributes: { header: 2 } },
      { insert: '[ ] Alex to complete backend test coverage\n[ ] Jane to update landing page mockups\n' }
    ]
  },
  'project-proposal': {
    ops: [
      { insert: 'Project Proposal: Next-Gen Docs\n', attributes: { header: 1 } },
      { insert: 'Author: ', attributes: { bold: true } },
      { insert: 'Product Team\n' },
      { insert: 'Status: ', attributes: { bold: true } },
      { insert: 'Draft\n\n' },
      { insert: '1. Overview\n', attributes: { header: 2 } },
      { insert: 'We propose building a lightning-fast real-time text editor with low-latency updates and rich formatting support.\n\n' },
      { insert: '2. Goals\n', attributes: { header: 2 } },
      { insert: '• Deliver real-time synchronization under 100ms.\n• Support multi-format export (PDF, TXT, HTML).\n' }
    ]
  },
  letter: {
    ops: [
      { insert: 'Dear [Recipient Name],\n\n' },
      { insert: 'I am writing to formally propose our upcoming partnership for the Collaborative Editor Project. We have reviewed the specifications and are excited to begin integration.\n\n' },
      { insert: 'Please let me know your availability for a sync call sometime next week.\n\n' },
      { insert: 'Sincerely,\n\n' },
      { insert: '[Your Name]\n', attributes: { bold: true } }
    ]
  }
};

// Helper: check user permission level for a document
const getPermissionLevel = (doc, userId) => {
  if (!userId) {
    return doc.isPublic && doc.globalPermission !== 'none' ? doc.globalPermission : 'none';
  }
  if (doc.ownerId === userId) return 'owner';

  const col = doc.collaborators.find((c) => c.userId === userId);
  if (col) return col.permission;

  if (doc.isPublic) return doc.globalPermission;

  return 'none';
};

// GET /api/documents - list user's documents
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { filter = 'all', search = '', sort = 'updated-desc' } = req.query;

    if (env.IS_DEMO_MODE) {
      // Seed welcome document if in memory is empty
      inMemoryDb.seed(req.user.id, req.user.name, req.user.email, req.user.imageUrl);
      const docs = inMemoryDb.findDocuments({ filter, search, sort, userId });
      return res.json(docs);
    }

    let query = {};

    // Filter rules
    if (filter === 'trash') {
      query.isTrashed = true;
      query.$or = [{ ownerId: userId }, { 'collaborators.userId': userId }];
    } else {
      query.isTrashed = false;
      if (filter === 'owned') {
        query.ownerId = userId;
      } else if (filter === 'shared') {
        query.ownerId = { $ne: userId };
        query['collaborators.userId'] = userId;
      } else if (filter === 'starred') {
        query.isStarred = true;
        query.$or = [{ ownerId: userId }, { 'collaborators.userId': userId }];
      } else {
        // all active documents
        query.$or = [{ ownerId: userId }, { 'collaborators.userId': userId }];
      }
    }

    // Search query
    if (search.trim() !== '') {
      query.title = { $regex: search, $options: 'i' };
    }

    // Sorting rules
    let sortOption = {};
    if (sort === 'title-asc') sortOption = { title: 1 };
    else if (sort === 'title-desc') sortOption = { title: -1 };
    else if (sort === 'created-desc') sortOption = { createdAt: -1 };
    else sortOption = { updatedAt: -1 }; // default: updated-desc

    const documents = await Document.find(query).sort(sortOption);
    res.json(documents);
  } catch (error) {
    next(error);
  }
});

// POST /api/documents - create new document
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, template = 'blank' } = req.body;
    const user = req.user;

    const initialContent = templates[template] || templates.blank;
    const formattedTitle = title || (template !== 'blank' 
      ? `${template.charAt(0).toUpperCase() + template.slice(1).replace('-', ' ')} Document` 
      : 'Untitled Document');

    if (env.IS_DEMO_MODE) {
      const newDoc = inMemoryDb.createDocument({
        title: formattedTitle,
        content: initialContent,
        ownerId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        ownerImageUrl: user.imageUrl,
      });

      inMemoryDb.createVersion({
        documentId: newDoc._id,
        content: initialContent,
        title: 'Created Document',
        createdById: user.id,
        createdByName: user.name,
      });

      return res.status(201).json(newDoc);
    }

    const newDoc = new Document({
      title: formattedTitle,
      content: initialContent,
      ownerId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
      ownerImageUrl: user.imageUrl,
      collaborators: [],
    });

    await newDoc.save();
    
    // Auto-save a V1 snapshot on creation
    const initialVersion = new Version({
      documentId: newDoc._id,
      content: initialContent,
      title: 'Created Document',
      createdById: user.id,
      createdByName: user.name,
    });
    await initialVersion.save();

    res.status(201).json(newDoc);
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/:id - get single document details
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const userId = req.user?.id;

    if (env.IS_DEMO_MODE) {
      // Make sure template Welcome doc exists
      const dummyId = userId || 'demo_user_123';
      inMemoryDb.seed(dummyId, 'Demo User', 'demo@example.com', '');

      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      const permission = getPermissionLevel(doc, userId);
      if (permission === 'none') {
        throw new APIError('Unauthorized to view this document', 403);
      }

      return res.json({ document: doc, permission });
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    const permission = getPermissionLevel(doc, userId);
    if (permission === 'none') {
      throw new APIError('Unauthorized to view this document', 403);
    }

    res.json({
      document: doc,
      permission, // 'owner', 'editor', 'commenter', 'viewer'
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/documents/:id - update metadata (e.g. title)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const userId = req.user.id;
    const { title, isStarred } = req.body;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      const permission = getPermissionLevel(doc, userId);
      if (permission !== 'owner' && permission !== 'editor') {
        throw new APIError('Unauthorized: You need write access to edit document info', 403);
      }

      const updated = inMemoryDb.updateDocument(docId, {
        ...(title !== undefined && { title }),
        ...(isStarred !== undefined && { isStarred }),
      });
      return res.json(updated);
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    const permission = getPermissionLevel(doc, userId);
    if (permission !== 'owner' && permission !== 'editor') {
      throw new APIError('Unauthorized: You need write access to edit document info', 403);
    }

    if (title !== undefined) doc.title = title;
    if (isStarred !== undefined) doc.isStarred = isStarred;

    await doc.save();
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/duplicate - duplicate document
router.post('/:id/duplicate', requireAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const user = req.user;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      const permission = getPermissionLevel(doc, user.id);
      if (permission === 'none') {
        throw new APIError('Unauthorized to copy this document', 403);
      }

      const duplicateDoc = inMemoryDb.createDocument({
        title: `Copy of ${doc.title}`,
        content: doc.content,
        ownerId: user.id,
        ownerName: user.name,
        ownerEmail: user.email,
        ownerImageUrl: user.imageUrl,
      });

      inMemoryDb.createVersion({
        documentId: duplicateDoc._id,
        content: duplicateDoc.content,
        title: 'Duplicated Document',
        createdById: user.id,
        createdByName: user.name,
      });

      return res.status(201).json(duplicateDoc);
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    const permission = getPermissionLevel(doc, user.id);
    if (permission === 'none') {
      throw new APIError('Unauthorized to copy this document', 403);
    }

    const duplicateDoc = new Document({
      title: `Copy of ${doc.title}`,
      content: doc.content,
      ownerId: user.id,
      ownerName: user.name,
      ownerEmail: user.email,
      ownerImageUrl: user.imageUrl,
      collaborators: [],
    });

    await duplicateDoc.save();

    const initialVersion = new Version({
      documentId: duplicateDoc._id,
      content: duplicateDoc.content,
      title: 'Duplicated Document',
      createdById: user.id,
      createdByName: user.name,
    });
    await initialVersion.save();

    res.status(201).json(duplicateDoc);
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/star - star document
router.post('/:id/star', requireAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const userId = req.user.id;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      const permission = getPermissionLevel(doc, userId);
      if (permission === 'none') {
        throw new APIError('Unauthorized to modify this document', 403);
      }

      const updated = inMemoryDb.updateDocument(docId, { isStarred: !doc.isStarred });
      return res.json(updated);
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    const permission = getPermissionLevel(doc, userId);
    if (permission === 'none') {
      throw new APIError('Unauthorized to modify this document', 403);
    }

    doc.isStarred = !doc.isStarred;
    await doc.save();
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/documents/:id - Move to trash or delete permanently
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const userId = req.user.id;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      if (doc.ownerId !== userId) {
        throw new APIError('Unauthorized: Only the owner can delete this document', 403);
      }

      const result = inMemoryDb.deleteDocument(docId, doc.isTrashed);
      if (result.isTrashed) {
        return res.json({ message: 'Document moved to trash successfully', isTrashed: true });
      } else {
        return res.json({ message: 'Document permanently deleted', isDeleted: true });
      }
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    // Only owner can delete or trash
    if (doc.ownerId !== userId) {
      throw new APIError('Unauthorized: Only the owner can delete this document', 403);
    }

    if (!doc.isTrashed) {
      // Soft delete
      doc.isTrashed = true;
      await doc.save();
      return res.json({ message: 'Document moved to trash successfully', isTrashed: true });
    } else {
      // Hard delete
      await Document.findByIdAndDelete(docId);
      await Version.deleteMany({ documentId: docId });
      return res.json({ message: 'Document permanently deleted', isDeleted: true });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/restore - Restore from trash
router.post('/:id/restore', requireAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const userId = req.user.id;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      if (doc.ownerId !== userId) {
        throw new APIError('Unauthorized: Only the owner can restore this document', 403);
      }

      const restored = inMemoryDb.restoreDocument(docId);
      return res.json({ message: 'Document restored successfully', doc: restored });
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    if (doc.ownerId !== userId) {
      throw new APIError('Unauthorized: Only the owner can restore this document', 403);
    }

    doc.isTrashed = false;
    await doc.save();
    res.json({ message: 'Document restored successfully', doc });
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/share - Share settings config
router.post('/:id/share', requireAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const userId = req.user.id;
    const { isPublic, globalPermission, email, permission: collPermission } = req.body;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      if (doc.ownerId !== userId) {
        throw new APIError('Unauthorized: Only the owner can update share settings', 403);
      }

      const updates = {};
      if (isPublic !== undefined) updates.isPublic = isPublic;
      if (globalPermission !== undefined) updates.globalPermission = globalPermission;

      const collaborators = [...doc.collaborators];

      if (email) {
        const namePrefix = email.split('@')[0];
        const formattedName = namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1);
        
        // Simulate User profile discovery in demo mode
        const mockClerkUser = {
          id: `demo_user_${namePrefix}_${Math.floor(Math.random()*1000)}`,
          name: formattedName,
          email: email,
          imageUrl: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=50&h=50&q=80`
        };

        if (email === doc.ownerEmail) {
          throw new APIError('User is already the owner of this document.', 400);
        }

        const existingIndex = collaborators.findIndex((c) => c.email === email);
        if (existingIndex > -1) {
          if (collPermission === 'none') {
            collaborators.splice(existingIndex, 1);
          } else {
            collaborators[existingIndex].permission = collPermission;
          }
        } else if (collPermission !== 'none') {
          collaborators.push({
            userId: mockClerkUser.id,
            name: mockClerkUser.name,
            email: email,
            imageUrl: mockClerkUser.imageUrl,
            permission: collPermission,
          });
        }
      }

      updates.collaborators = collaborators;
      const updated = inMemoryDb.updateDocument(docId, updates);
      return res.json(updated);
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    if (doc.ownerId !== userId) {
      throw new APIError('Unauthorized: Only the owner can update share settings', 403);
    }

    // Toggle public settings if provided
    if (isPublic !== undefined) doc.isPublic = isPublic;
    if (globalPermission !== undefined) doc.globalPermission = globalPermission;

    // Add collaborator if email is provided
    if (email) {
      // Search user by email in Clerk
      const usersList = await clerk.users.getUserList({ emailAddress: [email] });
      const clerkUser = usersList.data[0];

      if (!clerkUser) {
        throw new APIError('User with this email was not found in registered accounts.', 404);
      }

      if (clerkUser.id === doc.ownerId) {
        throw new APIError('User is already the owner of this document.', 400);
      }

      // Check if collaborator already exists
      const existingIndex = doc.collaborators.findIndex((c) => c.userId === clerkUser.id);

      if (existingIndex > -1) {
        if (collPermission === 'none') {
          // Remove collaborator
          doc.collaborators.splice(existingIndex, 1);
        } else {
          // Update permission
          doc.collaborators[existingIndex].permission = collPermission;
        }
      } else if (collPermission !== 'none') {
        // Add new collaborator
        doc.collaborators.push({
          userId: clerkUser.id,
          name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'User',
          email: email,
          imageUrl: clerkUser.imageUrl,
          permission: collPermission,
        });
      }
    }

    await doc.save();
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/:id/versions - List version history
router.get('/:id/versions', requireAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const userId = req.user.id;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      const permission = getPermissionLevel(doc, userId);
      if (permission === 'none') {
        throw new APIError('Unauthorized to view version history', 403);
      }

      const versions = inMemoryDb.findVersionsByDocumentId(docId);
      return res.json(versions);
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    const permission = getPermissionLevel(doc, userId);
    if (permission === 'none') {
      throw new APIError('Unauthorized to view version history', 403);
    }

    const versions = await Version.find({ documentId: docId }).sort({ createdAt: -1 });
    res.json(versions);
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/versions - Create a manual snapshot
router.post('/:id/versions', requireAuth, async (req, res, next) => {
  try {
    const docId = req.params.id;
    const user = req.user;
    const { title } = req.body;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      const permission = getPermissionLevel(doc, user.id);
      if (permission !== 'owner' && permission !== 'editor') {
        throw new APIError('Unauthorized to create a snapshot version', 403);
      }

      const newVersion = inMemoryDb.createVersion({
        documentId: docId,
        content: doc.content,
        title: title || `Version Snapshot - ${new Date().toLocaleTimeString()}`,
        createdById: user.id,
        createdByName: user.name,
      });
      return res.status(201).json(newVersion);
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    const permission = getPermissionLevel(doc, user.id);
    if (permission !== 'owner' && permission !== 'editor') {
      throw new APIError('Unauthorized to create a snapshot version', 403);
    }

    const newVersion = new Version({
      documentId: docId,
      content: doc.content,
      title: title || `Version Snapshot - ${new Date().toLocaleTimeString()}`,
      createdById: user.id,
      createdByName: user.name,
    });

    await newVersion.save();
    res.status(201).json(newVersion);
  } catch (error) {
    next(error);
  }
});

// POST /api/documents/:id/versions/:versionId/restore - Restore a specific version
router.post('/:id/versions/:versionId/restore', requireAuth, async (req, res, next) => {
  try {
    const { id: docId, versionId } = req.params;
    const user = req.user;

    if (env.IS_DEMO_MODE) {
      const doc = inMemoryDb.findDocumentById(docId);
      if (!doc) {
        throw new APIError('Document not found', 404);
      }

      const permission = getPermissionLevel(doc, user.id);
      if (permission !== 'owner' && permission !== 'editor') {
        throw new APIError('Unauthorized to restore document versions', 403);
      }

      const version = inMemoryDb.findVersionById(versionId, docId);
      if (!version) {
        throw new APIError('Version snapshot not found', 404);
      }

      // Save backup before restore
      inMemoryDb.createVersion({
        documentId: docId,
        content: doc.content,
        title: `Pre-restore Backup - ${new Date().toLocaleTimeString()}`,
        createdById: user.id,
        createdByName: user.name,
      });

      const updated = inMemoryDb.updateDocument(docId, { content: version.content });
      return res.json({ message: 'Document content restored successfully', content: updated.content });
    }

    const doc = await Document.findById(docId);
    if (!doc) {
      throw new APIError('Document not found', 404);
    }

    const permission = getPermissionLevel(doc, user.id);
    if (permission !== 'owner' && permission !== 'editor') {
      throw new APIError('Unauthorized to restore document versions', 403);
    }

    const version = await Version.findOne({ _id: versionId, documentId: docId });
    if (!version) {
      throw new APIError('Version snapshot not found', 404);
    }

    // Save current content as a version snapshot before restoring
    const backupVersion = new Version({
      documentId: docId,
      content: doc.content,
      title: `Pre-restore Backup - ${new Date().toLocaleTimeString()}`,
      createdById: user.id,
      createdByName: user.name,
    });
    await backupVersion.save();

    // Restore version content
    doc.content = version.content;
    await doc.save();

    res.json({ message: 'Document content restored successfully', content: doc.content });
  } catch (error) {
    next(error);
  }
});

export default router;
