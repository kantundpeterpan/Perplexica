import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import { MCPServerTransport } from '@/lib/config/types';

/* GET /api/mcp/servers - list all configured MCP servers */
export const GET = async (_req: NextRequest) => {
  try {
    const mcpConfig = configManager.getConfig('mcp');
    return NextResponse.json({ servers: mcpConfig?.servers ?? [] });
  } catch (err: any) {
    return NextResponse.json(
      { message: err?.message ?? 'Failed to list servers.' },
      { status: 500 },
    );
  }
};

/* POST /api/mcp/servers - add a new MCP server */
export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { name, transport, defaultScope } = body as {
      name: string;
      transport: MCPServerTransport;
      defaultScope?: 'allow' | 'ask';
    };

    if (!name || !transport) {
      return NextResponse.json(
        { message: 'name and transport are required.' },
        { status: 400 },
      );
    }

    const server = configManager.addMCPServer(
      name,
      transport,
      defaultScope ?? 'allow',
    );

    return NextResponse.json({ server }, { status: 201 });
  } catch (err: any) {
    console.error('MCP add server error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Failed to add server.' },
      { status: 500 },
    );
  }
};
