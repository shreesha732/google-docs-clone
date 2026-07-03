import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().url({ message: 'MONGODB_URI must be a valid MongoDB Atlas connection URL' }).optional(),
  CLERK_SECRET_KEY: z.string().min(1, { message: 'CLERK_SECRET_KEY is required for authentication' }).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const validateEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables configuration:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    process.exit(1);
  }

  const data = result.data;
  data.IS_DEMO_MODE = !data.MONGODB_URI || !data.CLERK_SECRET_KEY;

  return data;
};

export const env = validateEnv();
