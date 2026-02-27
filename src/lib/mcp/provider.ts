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

class MCPProvider {
  private baseURL: string;
  private apiKey?: string;

  constructor(baseURL: string, apiKey?: string) {
    this.baseURL = baseURL.replace(/\/$/, '');
    this.apiKey = apiKey;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private async rpc(method: string, params?: any): Promise<any> {
    const body = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      ...(params !== undefined ? { params } : {}),
    };

    const res = await fetch(this.baseURL, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(
        `MCP request failed: ${res.status} ${res.statusText}`,
      );
    }

    const json = await res.json();

    if (json.error) {
      throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
    }

    return json.result;
  }

  async listTools(): Promise<MCPTool[]> {
    const result = await this.rpc('tools/list');
    return (result?.tools ?? []) as MCPTool[];
  }

  async callTool(name: string, args: Record<string, any>): Promise<MCPToolCallResult> {
    const result = await this.rpc('tools/call', { name, arguments: args });
    return result as MCPToolCallResult;
  }

  async checkConnection(): Promise<{ ok: boolean; tools: MCPTool[] }> {
    const tools = await this.listTools();
    return { ok: true, tools };
  }
}

export default MCPProvider;
