import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const collaboratorSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  imageUrl: { type: String },
  permission: {
    type: String,
    enum: ['owner', 'editor', 'commenter', 'viewer'],
    required: true,
  },
}, { _id: false });

const documentSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => nanoid(12),
    },
    title: {
      type: String,
      default: 'Untitled Document',
    },
    content: {
      type: Object,
      default: { ops: [{ insert: '\n' }] }, // Default Quill Delta (empty line)
    },
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    ownerName: {
      type: String,
      required: true,
    },
    ownerEmail: {
      type: String,
      required: true,
    },
    ownerImageUrl: {
      type: String,
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    isTrashed: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    globalPermission: {
      type: String,
      enum: ['none', 'viewer', 'commenter', 'editor'],
      default: 'none',
    },
    collaborators: [collaboratorSchema],
  },
  {
    timestamps: true,
    _id: false, // Because we specify our custom String _id
  }
);

// Indexes for query performance
documentSchema.index({ ownerId: 1, isTrashed: 1 });
documentSchema.index({ 'collaborators.userId': 1, isTrashed: 1 });

export const Document = mongoose.model('Document', documentSchema);
export default Document;
