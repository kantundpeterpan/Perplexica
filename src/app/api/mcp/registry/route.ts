import { NextRequest, NextResponse } from 'next/server';
import { MCPServerTransport } from '@/lib/config/types';

const REGISTRY_API = 'https://registry.modelcontextprotocol.io/v0.1';
const REGISTRY_LOOKUP_TIMEOUT_MS = 8_000;

/**
 * Resolve positional runtime arguments to an ordered string array.
 * Named (--flag=value) args are appended in their declared order.
 */
const resolveArgs = (args: any[]): string[] => {
  if (!Array.isArray(args)) return [];
  const positional = args
    .filter((a) => a.type === 'positional' && a.value !== undefined)
    .map((a) => String(a.value));
  const named = args
    .filter((a) => a.type === 'named' && a.name && a.value !== undefined)
    .map((a) => `${a.name}=${a.value}`);
  return [...positional, ...named];
};

/**
 * Build an MCPServerTransport from a list of registry packages.
 * Precedence: npm/npx → pypi/uvx → docker → streamable-http.
 */
const buildTransportFromPackages = (packages: any[]): MCPServerTransport | null => {
  for (const pkg of packages) {
    const pkgArgs = resolveArgs(pkg.packageArguments ?? []);
    // npm via npx
    if (pkg.registryType === 'npm' || pkg.runtimeHint === 'npx') {
      const runtimeArgs =
        resolveArgs(pkg.runtimeArguments ?? []).length > 0
          ? resolveArgs(pkg.runtimeArguments)
          : pkg.identifier
            ? ['-y', pkg.identifier]
            : [];
      return {
        type: 'stdio',
        command: pkg.runtimeHint ?? 'npx',
        args: [...runtimeArgs, ...pkgArgs],
      };
    }
    // pypi via uvx
    if (pkg.registryType === 'pypi' || pkg.runtimeHint === 'uvx') {
      const runtimeArgs =
        resolveArgs(pkg.runtimeArguments ?? []).length > 0
          ? resolveArgs(pkg.runtimeArguments)
          : pkg.identifier
            ? [pkg.identifier]
            : [];
      return {
        type: 'stdio',
        command: pkg.runtimeHint ?? 'uvx',
        args: [...runtimeArgs, ...pkgArgs],
      };
    }
    // docker
    if (pkg.runtimeHint === 'docker') {
      return {
        type: 'stdio',
        command: 'docker',
        args: resolveArgs(pkg.runtimeArguments ?? []),
      };
    }
    // HTTP (streamable-http or sse)
    if (
      pkg.transport?.type === 'streamable-http' ||
      pkg.transport?.type === 'sse'
    ) {
      const url: string = pkg.transport.url ?? '';
      if (url) return { type: 'http', url };
    }
  }
  return null;
};

/**
 * Fetch the latest version detail for a fully-qualified server name.
 * serverName MUST already be URL-encoded.
 */
const fetchServerDetail = async (encodedName: string): Promise<any> => {
  const res = await fetch(
    `${REGISTRY_API}/servers/${encodedName}/versions/latest`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REGISTRY_LOOKUP_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Not found (${res.status})`);
  return res.json();
};

/**
 * GET /api/mcp/registry?slug=<slug>
 *
 * Accepts either:
 *  - A fully-qualified registry name: "io.modelcontextprotocol/filesystem"
 *  - A short search term:            "filesystem"
 *
 * Returns { name, description, transport } to pre-fill the Add Server dialog.
 */
export const GET = async (req: NextRequest) => {
  try {
    const slug = req.nextUrl.searchParams.get('slug')?.trim();

    if (!slug) {
      return NextResponse.json(
        { message: 'slug query param is required.' },
        { status: 400 },
      );
    }

    let serverData: any;

    if (slug.includes('/')) {
      /* Fully-qualified name — direct lookup */
      try {
        serverData = await fetchServerDetail(encodeURIComponent(slug));
      } catch (err: any) {
        return NextResponse.json(
          { message: `Registry returned an error for "${slug}": ${err.message}` },
          { status: 404 },
        );
      }
    } else {
      /* Short name — search first, then fetch full detail */
      const searchRes = await fetch(
        `${REGISTRY_API}/servers?search=${encodeURIComponent(slug)}&limit=5`,
        {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(REGISTRY_LOOKUP_TIMEOUT_MS),
        },
      );
      if (!searchRes.ok) {
        return NextResponse.json(
          { message: `Registry search failed (${searchRes.status}).` },
          { status: 404 },
        );
      }
      const list = await searchRes.json();
      const servers: any[] = list.servers ?? [];
      if (servers.length === 0) {
        return NextResponse.json(
          { message: `No servers found matching "${slug}". Try the fully-qualified name (e.g. "io.modelcontextprotocol/filesystem").` },
          { status: 404 },
        );
      }
      /* If the list response already includes packages, use it; otherwise fetch detail */
      const first = servers[0];
      if (first.packages && first.packages.length > 0) {
        serverData = first;
      } else {
        try {
          serverData = await fetchServerDetail(encodeURIComponent(first.name));
        } catch {
          serverData = first;
        }
      }
    }

    const transport = buildTransportFromPackages(serverData.packages ?? []);

    return NextResponse.json({
      name: serverData.title ?? serverData.name ?? slug,
      description: serverData.description ?? '',
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
