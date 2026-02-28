import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import MCPClient from '@/lib/mcp/provider';
import { MCPServerConfig } from '@/lib/config/types';

export const GET = async (_req: NextRequest) => {
  try {
    const mcpConfig = configManager.getConfig('mcp');
    const servers: MCPServerConfig[] = mcpConfig?.servers ?? [];
    const enabledServers = servers.filter((s: MCPServerConfig) => s.enabled);

    // Built-in research tools that are always available
    const builtinTools = [
      { name: 'web_search', description: 'Perform web searches via SearxNG', server: 'built-in' },
      { name: 'academic_search', description: 'Search academic papers and articles', server: 'built-in' },
      { name: 'social_search', description: 'Search online discussions and forums', server: 'built-in' },
      { name: 'scrape_url', description: 'Read and extract content from a URL', server: 'built-in' },
      { name: 'uploads_search', description: 'Search user-uploaded documents', server: 'built-in' },
    ];

    if (enabledServers.length === 0) {
      return NextResponse.json({ tools: builtinTools });
    }

    const results = await Promise.allSettled(
      enabledServers.map(async (serverCfg: MCPServerConfig) => {
        const client = new MCPClient(serverCfg);
        const tools = await client.listTools();
        return tools.map((t) => ({ ...t, server: serverCfg.name }));
      }),
    );

    const mcpTools = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<any>).value);

    return NextResponse.json({ tools: [...builtinTools, ...mcpTools] });
  } catch (err: any) {
    console.error('MCP tools list error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Failed to fetch tools.' },
      { status: 500 },
    );
  }
};
