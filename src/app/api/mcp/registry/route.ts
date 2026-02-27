import { NextRequest, NextResponse } from 'next/server';
import { MCPServerTransport } from '@/lib/config/types';

const REGISTRY_BASE = 'https://registry.modelcontextprotocol.io/servers';
const REGISTRY_LOOKUP_TIMEOUT_MS = 8_000;

/**
 * GET /api/mcp/registry?slug=<slug>
 *
 * Looks up an MCP server by its registry slug and returns a proposed
 * MCPServerConfig transport so the frontend can pre-fill the Add dialog.
 */
export const GET = async (req: NextRequest) => {
  try {
    const slug = req.nextUrl.searchParams.get('slug');

    if (!slug) {
      return NextResponse.json(
        { message: 'slug query param is required.' },
        { status: 400 },
      );
    }

    const registryRes = await fetch(`${REGISTRY_BASE}/${slug}`, {
      headers: { Accept: 'application/json' },
      // short timeout so the UI doesn't hang indefinitely
      signal: AbortSignal.timeout(REGISTRY_LOOKUP_TIMEOUT_MS),
    });

    if (!registryRes.ok) {
      return NextResponse.json(
        {
          message: `Registry returned ${registryRes.status} for slug "${slug}".`,
        },
        { status: 404 },
      );
    }

    const data = await registryRes.json();

    /* Map registry package metadata → MCPServerTransport
     * The registry exposes `packages[].runtime` and `packages[].runtime_arguments`
     * for npm/npx-style installs.  We prefer npx for zero-install convenience.
     */
    let transport: MCPServerTransport | null = null;

    const pkgs: any[] = data.packages ?? [];

    const npmPkg = pkgs.find(
      (p: any) => p.registry_name === 'npm' || p.runtime === 'npx',
    );

    if (npmPkg) {
      const args: string[] = [];
      if (npmPkg.runtime === 'npx' && npmPkg.runtime_arguments) {
        args.push(...(npmPkg.runtime_arguments as string[]));
      } else if (npmPkg.name) {
        args.push('-y', npmPkg.name);
      }
      transport = {
        type: 'stdio',
        command: 'npx',
        args,
      };
    }

    /* Fallback: if the server exposes an HTTP endpoint */
    if (!transport && data.url) {
      transport = { type: 'http', url: data.url };
    }

    return NextResponse.json({
      name: data.name ?? slug,
      description: data.description ?? '',
      transport,
    });
  } catch (err: any) {
    console.error('MCP registry lookup error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Registry lookup failed.' },
      { status: 500 },
    );
  }
};
