import { NextRequest, NextResponse } from 'next/server';
import configManager from '@/lib/config';
import MCPProvider from '@/lib/mcp/provider';

export const GET = async (_req: NextRequest) => {
  try {
    const mcpConfig = configManager.getConfig('mcp');

    if (!mcpConfig?.enabled || !mcpConfig?.baseURL) {
      return NextResponse.json({ tools: [] });
    }

    const provider = new MCPProvider(mcpConfig.baseURL, mcpConfig.apiKey);
    const tools = await provider.listTools();

    return NextResponse.json({ tools });
  } catch (err: any) {
    console.error('MCP tools list error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Failed to fetch tools.' },
      { status: 500 },
    );
  }
};
