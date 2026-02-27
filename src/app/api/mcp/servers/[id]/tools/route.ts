import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import MCPClient from '@/lib/mcp/provider';
import { MCPServerConfig } from '@/lib/config/types';

/* GET /api/mcp/servers/[id]/tools - list tools for a specific server */
export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const { id } = await params;
    const mcpConfig = configManager.getConfig('mcp');
    const server = (mcpConfig?.servers ?? []).find(
      (s: MCPServerConfig) => s.id === id,
    );

    if (!server) {
      return NextResponse.json(
        { message: `MCP server ${id} not found.` },
        { status: 404 },
      );
    }

    const client = new MCPClient(server);
    const tools = await client.listTools();

    return NextResponse.json({ tools });
  } catch (err: any) {
    console.error('MCP list server tools error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message ?? 'Failed to list tools.' },
      { status: 200 },
    );
  }
};
