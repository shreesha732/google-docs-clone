import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async () => {
  if (env.IS_DEMO_MODE) {
    console.log('⚡ Server running in DEMO MODE (In-Memory Database store, no MongoDB dependency).');
    return;
  }

  try {
    const conn = await mongoose.connect(env.MONGODB_URI);
    console.log(`📡 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};
