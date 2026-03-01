import { spawn } from 'child_process';
import {
  MCPServerConfig,
  MCPServerTransportHttp,
  MCPServerTransportStdio,
} from '@/lib/config/types';

export type MCPTool = {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
};

export type MCPToolCallResult = {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
      uri: string;
      text?: string;
      blob?: string;
    };
  }>;
  isError?: boolean;
};

/* ──────────────────────────────────────────────
   HTTP transport (stateless JSON-RPC over POST)
   ────────────────────────────────────────────── */
async function httpRpc(
  url: string,
  headers: Record<string, string>,
  method: string,
  params?: any,
): Promise<any> {
  const body = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method,
    ...(params !== undefined ? { params } : {}),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`MCP HTTP error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.error) {
    throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  }
  return json.result;
}

/* ──────────────────────────────────────────────
   Stdio transport (subprocess + JSON-RPC over stdin/stdout)
   Each call spawns a fresh process to avoid state leaks.
   ────────────────────────────────────────────── */
async function stdioRpc(
  cfg: MCPServerTransportStdio,
  method: string,
  params?: any,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn(cfg.command, cfg.args ?? [], {
      env: { ...process.env, ...(cfg.env ?? {}) },
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    const pending = new Map<
      string,
      { resolve: (v: any) => void; reject: (e: Error) => void }
    >();
    let buffer = '';

    child.stdout!.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id && pending.has(msg.id)) {
            const p = pending.get(msg.id)!;
            pending.delete(msg.id);
            if (msg.error) {
              p.reject(
                new Error(`MCP error ${msg.error.code}: ${msg.error.message}`),
              );
            } else {
              p.resolve(msg.result);
            }
          }
        } catch {
          /* ignore non-JSON lines (e.g. progress notifications) */
        }
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn MCP process: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0 && pending.size > 0) {
        pending.forEach(({ reject: rej }) =>
          rej(new Error(`MCP stdio process exited unexpectedly with code ${code}`)),
        );
        pending.clear();
      }
    });

    const send = (msg: object) => {
      child.stdin!.write(JSON.stringify(msg) + '\n');
    };

    const rpc = (m: string, p?: any): Promise<any> => {
      const id = crypto.randomUUID();
      return new Promise((res2, rej2) => {
        pending.set(id, { resolve: res2, reject: rej2 });
        send({ jsonrpc: '2.0', id, method: m, ...(p !== undefined ? { params: p } : {}) });
      });
    };

    /* MCP handshake then execute the real call */
    (async () => {
      try {
        await rpc('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'perplexica', version: '1.0' },
        });
        /* send notification (fire-and-forget, no id) */
        send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

        const result = await rpc(method, params);
        child.stdin!.end();
        resolve(result);
      } catch (err) {
        child.stdin!.end();
        reject(
          err instanceof Error
            ? err
            : new Error(`MCP stdio call failed: ${String(err)}`),
        );
      }
    })();
  });
}

/* ──────────────────────────────────────────────
   Unified MCP client
   ────────────────────────────────────────────── */
class MCPClient {
  constructor(private cfg: MCPServerConfig) {}

  private rpc(method: string, params?: any): Promise<any> {
    if (this.cfg.transport.type === 'stdio') {
      return stdioRpc(this.cfg.transport as MCPServerTransportStdio, method, params);
    }

    const t = this.cfg.transport as MCPServerTransportHttp;
    return httpRpc(t.url, t.headers ?? {}, method, params);
  }

  async listTools(): Promise<MCPTool[]> {
    const result = await this.rpc('tools/list');
    return (result?.tools ?? []) as MCPTool[];
  }

  async callTool(
    name: string,
    args: Record<string, any>,
  ): Promise<MCPToolCallResult> {
    const result = await this.rpc('tools/call', { name, arguments: args });
    return result as MCPToolCallResult;
  }

  async checkConnection(): Promise<{ ok: boolean; tools: MCPTool[] }> {
    const tools = await this.listTools();
    return { ok: true, tools };
  }
}

/**
 * Build an MCPClient from a transport descriptor without a full MCPServerConfig.
 * Used by the `/api/mcp/check` endpoint.
 */
export function buildClientFromTransport(
  transport: MCPServerConfig['transport'],
): MCPClient {
  const fakeCfg: MCPServerConfig = {
    id: 'check',
    name: 'check',
    enabled: true,
    defaultScope: 'allow',
    toolOverrides: [],
    transport,
  };
  return new MCPClient(fakeCfg);
}

export default MCPClient;
