import mongoose from 'mongoose';
import { nanoid } from 'nanoid';

const versionSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => nanoid(12),
    },
    documentId: {
      type: String,
      required: true,
      ref: 'Document',
      index: true,
    },
    content: {
      type: Object,
      required: true,
    },
    title: {
      type: String,
      required: true,
      default: 'Version Snapshot',
    },
    createdById: {
      type: String,
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    _id: false,
  }
);

export const Version = mongoose.model('Version', versionSchema);
export default Version;
