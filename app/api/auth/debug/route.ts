import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
    // Don't expose actual values, just check if they exist
  };

  return NextResponse.json({
    message: 'Auth configuration debug info',
    config: envVars,
    timestamp: new Date().toISOString(),
  });
}
