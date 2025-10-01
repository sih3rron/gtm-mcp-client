import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch available resources from MCP service
    const response = await fetch(`${process.env.MIRO_MCP_SERVICE_URL}/resources`, {
      headers: {
        'Authorization': `Bearer ${process.env.SERVICE_API_KEY}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch resources from MCP service');
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching MCP resources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}