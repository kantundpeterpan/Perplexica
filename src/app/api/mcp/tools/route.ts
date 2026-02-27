import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import MCPClient from '@/lib/mcp/provider';
import { MCPServerConfig } from '@/lib/config/types';

export const GET = async (_req: NextRequest) => {
  try {
    const mcpConfig = configManager.getConfig('mcp');
    const servers: MCPServerConfig[] = mcpConfig?.servers ?? [];
    const enabledServers = servers.filter((s: MCPServerConfig) => s.enabled);

    if (enabledServers.length === 0) {
      return NextResponse.json({ tools: [] });
    }

    const results = await Promise.allSettled(
      enabledServers.map(async (serverCfg: MCPServerConfig) => {
        const client = new MCPClient(serverCfg);
        const tools = await client.listTools();
        return { server: serverCfg.name, tools };
      }),
    );

    const tools = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<any>).value.tools);

    return NextResponse.json({ tools });
  } catch (err: any) {
    console.error('MCP tools list error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Failed to fetch tools.' },
      { status: 500 },
    );
  }
};
