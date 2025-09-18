import { NextResponse } from 'next/server';
import { auth } from '../../../../../lib/auth';

export async function GET(
  request: Request,
  { params }: { params: { path: string[] } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resourcePath = params.path.join('/');
    const response = await fetch(`${process.env.MIRO_MCP_SERVICE_URL}/resources/${resourcePath}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch resource from MCP service');
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching MCP resource:', error);
    return NextResponse.json(
      { error: 'Failed to fetch resource' },
      { status: 500 }
    );
  }
}