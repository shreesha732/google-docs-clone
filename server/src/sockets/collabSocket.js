import { Document } from '../models/Document.js';
import { env } from '../config/env.js';
import { inMemoryDb } from '../config/inMemoryDb.js';

// Map of active collaborators by document ID
// documentId -> { socketId: { userId, name, email, imageUrl, color, cursor } }
const activeUsers = new Map();

// High-contrast, beautiful pastel colors for collaborator cursors
const COLLABORATOR_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
];

export const setupSockets = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 New client connected: ${socket.id}`);

    // Join Document Room
    socket.on('join-document', async ({ docId, user }) => {
      if (!docId || !user || !user.id) return;

      socket.join(docId);
      socket.docId = docId;
      socket.user = user;

      // Assign a random color
      const color = COLLABORATOR_COLORS[Math.floor(Math.random() * COLLABORATOR_COLORS.length)];
      
      // Initialize room users if not exists
      if (!activeUsers.has(docId)) {
        activeUsers.set(docId, {});
      }

      // Add user to active users map
      const roomUsers = activeUsers.get(docId);
      roomUsers[socket.id] = {
        userId: user.id,
        name: user.name,
        email: user.email || '',
        imageUrl: user.imageUrl || '',
        color,
        cursor: null,
      };

      // Broadcast updated collaborator list
      io.to(docId).emit('collaborators-update', Object.values(roomUsers));
      console.log(`👤 User "${user.name}" joined document room: ${docId}`);
    });

    // Handle incoming edits (delta operations) and broadcast to others
    socket.on('send-changes', (delta) => {
      const { docId } = socket;
      if (!docId) return;

      // Broadcast changes to everyone else in the document room
      socket.to(docId).emit('receive-changes', delta);
    });

    // Handle cursor position updates
    socket.on('cursor-move', (range) => {
      const { docId } = socket;
      if (!docId) return;

      const roomUsers = activeUsers.get(docId);
      if (roomUsers && roomUsers[socket.id]) {
        // Update user cursor state
        roomUsers[socket.id].cursor = range;
        
        // Broadcast the cursor move event to others
        socket.to(docId).emit('cursor-update', {
          socketId: socket.id,
          userId: roomUsers[socket.id].userId,
          name: roomUsers[socket.id].name,
          color: roomUsers[socket.id].color,
          cursor: range,
        });
      }
    });

    // Handle document auto-saves
    socket.on('save-document', async (content, callback) => {
      const { docId } = socket;
      if (!docId) {
        if (callback) callback({ success: false, error: 'No active document session' });
        return;
      }

      try {
        if (env.IS_DEMO_MODE) {
          inMemoryDb.updateDocument(docId, { content });
        } else {
          await Document.findByIdAndUpdate(docId, { content });
        }
        // Let the client know saving is done
        if (callback) callback({ success: true });
        
        // Also emit to the room that the document has been updated
        socket.to(docId).emit('document-updated-externally');
      } catch (error) {
        console.error(`Error saving document ${docId}:`, error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      const { docId } = socket;
      if (docId && activeUsers.has(docId)) {
        const roomUsers = activeUsers.get(docId);
        
        // Remove user from the active users list
        delete roomUsers[socket.id];
        
        // If no users left in room, delete room from map
        if (Object.keys(roomUsers).length === 0) {
          activeUsers.delete(docId);
        } else {
          // Otherwise, notify others of the updated collaborator list
          io.to(docId).emit('collaborators-update', Object.values(roomUsers));
          socket.to(docId).emit('collaborator-disconnected', socket.id);
        }
        console.log(`👤 Client disconnected: ${socket.id} from room ${docId}`);
      } else {
        console.log(`🔌 Client disconnected: ${socket.id}`);
      }
    });
  });
};
