import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import { MCPServerTransport } from '@/lib/config/types';

/* PUT /api/mcp/servers/[id] - update an existing MCP server */
export const PUT = async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  try {
    const { id } = params;
    const body = await req.json();
    const { name, transport, defaultScope, enabled } = body as {
      name?: string;
      transport?: MCPServerTransport;
      defaultScope?: 'allow' | 'ask';
      enabled?: boolean;
    };

    const updated = configManager.updateMCPServer(id, {
      ...(name !== undefined && { name }),
      ...(transport !== undefined && { transport }),
      ...(defaultScope !== undefined && { defaultScope }),
      ...(enabled !== undefined && { enabled }),
    });

    return NextResponse.json({ server: updated });
  } catch (err: any) {
    console.error('MCP update server error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Failed to update server.' },
      { status: 500 },
    );
  }
};

/* DELETE /api/mcp/servers/[id] - remove an MCP server */
export const DELETE = async (
  _req: NextRequest,
  { params }: { params: { id: string } },
) => {
  try {
    const { id } = params;
    configManager.removeMCPServer(id);
    return NextResponse.json({ message: 'Server removed successfully.' });
  } catch (err: any) {
    console.error('MCP delete server error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Failed to remove server.' },
      { status: 500 },
    );
  }
};
