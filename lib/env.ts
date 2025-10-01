import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  MIRO_MCP_SERVICE_URL: z.string().url().optional(),
  MIRO_ACCESS_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SERVICE_API_KEY: z.string().optional(),
});

// Export raw environment variables without validation
export const env = process.env;

// Export validation function for runtime validation
export function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = (error as z.ZodError).issues.map((err: z.ZodIssue) => err.path.join('.')).join(', ');
      throw new Error(
        `Missing or invalid environment variables: ${missingVars}\n` +
        `Please check your .env.local file and ensure all required variables are set.\n` +
        `Required variables: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET`
      );
    }
    throw error;
  }
}

// Export a function to get validated env when needed
export function getValidatedEnv() {
  return validateEnv();
}
