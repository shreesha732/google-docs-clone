import { createClerkClient } from '@clerk/backend';
import { env } from '../config/env.js';

// Instantiate clerk only if not in demo mode
const clerk = env.IS_DEMO_MODE ? null : createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Static mock user details for Demo Mode
const MOCK_USER = {
  id: 'demo_user_123',
  name: 'Demo Architect',
  email: 'demo@example.com',
  imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80',
};

// Simple in-memory cache for user profiles to avoid hitting Clerk API on every request
const userCache = new Map();
const CACHE_TTL = 1000 * 60 * 15; // 15 minutes

const getCachedUser = async (userId) => {
  if (env.IS_DEMO_MODE) {
    return MOCK_USER;
  }

  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const user = await clerk.users.getUser(userId);
    const userData = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Anonymous User',
      imageUrl: user.imageUrl || '',
    };
    userCache.set(userId, { data: userData, timestamp: Date.now() });
    return userData;
  } catch (error) {
    console.error(`Failed to fetch user ${userId} from Clerk:`, error);
    return {
      id: userId,
      email: '',
      name: 'Collaborator',
      imageUrl: '',
    };
  }
};

export const requireAuth = async (req, res, next) => {
  // Shortcut if running in Demo Mode
  if (env.IS_DEMO_MODE) {
    req.user = MOCK_USER;
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const verified = await clerk.verifyToken(token);
    const userId = verified.sub;

    // Fetch user details (via cache)
    const userDetails = await getCachedUser(userId);
    
    req.user = userDetails;
    next();
  } catch (error) {
    console.error('Authentication Error:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  // Shortcut if running in Demo Mode
  if (env.IS_DEMO_MODE) {
    req.user = MOCK_USER;
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];
    const verified = await clerk.verifyToken(token);
    const userId = verified.sub;

    const userDetails = await getCachedUser(userId);
    req.user = userDetails;
    next();
  } catch (error) {
    // If invalid token, proceed as anonymous
    req.user = null;
    next();
  }
};
