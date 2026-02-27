import { NextRequest, NextResponse } from 'next/server';
import MCPProvider from '@/lib/mcp/provider';

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { baseURL, apiKey } = body as { baseURL: string; apiKey?: string };

    if (!baseURL) {
      return NextResponse.json(
        { message: 'baseURL is required.' },
        { status: 400 },
      );
    }

    const provider = new MCPProvider(baseURL, apiKey);
    const { ok, tools } = await provider.checkConnection();

    return NextResponse.json({ ok, tools });
  } catch (err: any) {
    console.error('MCP check error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message ?? 'Connection failed.' },
      { status: 200 },
    );
  }
};
