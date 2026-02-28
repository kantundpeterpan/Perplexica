import { NextRequest, NextResponse } from 'next/server';
import { buildClientFromTransport } from '@/lib/mcp/provider';
import { MCPServerTransport } from '@/lib/config/types';

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();

    /* Support the new transport format as well as a legacy {baseURL, apiKey} form */
    let transport: MCPServerTransport;

    if (body.transport) {
      transport = body.transport as MCPServerTransport;
    } else if (body.baseURL) {
      /* Legacy shape: { baseURL, apiKey? } */
      transport = {
        type: 'http',
        url: body.baseURL as string,
        headers: body.apiKey
          ? { Authorization: `Bearer ${body.apiKey}` }
          : undefined,
      };
    } else {
      return NextResponse.json(
        { message: 'transport (or legacy baseURL) is required.' },
        { status: 400 },
      );
    }

    const client = buildClientFromTransport(transport);
    const { ok, tools } = await client.checkConnection();

    return NextResponse.json({ ok, tools });
  } catch (err: any) {
    console.error('MCP check error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message ?? 'Connection failed.' },
      { status: 200 },
    );
  }
};
