import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk } from '@/lib/types';
import MCPProvider, { MCPTool } from '@/lib/mcp/provider';
import configManager from '@/lib/config';

const buildSchema = (tool: MCPTool) => {
  const properties: Record<string, z.ZodTypeAny> = {};

  const inputProps = tool.inputSchema?.properties ?? {};
  const required = tool.inputSchema?.required ?? [];

  for (const [key, schemaDef] of Object.entries(inputProps)) {
    const def = schemaDef as any;
    let zodField: z.ZodTypeAny;

    switch (def.type) {
      case 'number':
      case 'integer':
        zodField = z.number().describe(def.description ?? '');
        break;
      case 'boolean':
        zodField = z.boolean().describe(def.description ?? '');
        break;
      case 'array':
        zodField = z.array(z.unknown()).describe(def.description ?? '');
        break;
      case 'object':
        zodField = z.record(z.string(), z.unknown()).describe(def.description ?? '');
        break;
      default:
        zodField = z.string().describe(def.description ?? '');
    }

    if (!required.includes(key)) {
      zodField = zodField.optional() as z.ZodTypeAny;
    }

    properties[key] = zodField;
  }

  return z.object({
    type: z.literal(tool.name),
    ...properties,
  });
};

const createMCPAction = (
  tool: MCPTool,
  provider: MCPProvider,
): ResearchAction<any> => {
  const schema = buildSchema(tool);

  return {
    name: tool.name,
    schema,
    getToolDescription: () => tool.description,
    getDescription: () => tool.description,
    enabled: (_config) => {
      const mcpConfig = configManager.getConfig('mcp');
      return mcpConfig?.enabled === true;
    },
    execute: async (params, additionalConfig) => {
      const { type: _type, ...args } = params as any;

      const researchBlock = additionalConfig.session.getBlock(
        additionalConfig.researchBlockId,
      );

      if (researchBlock && researchBlock.type === 'research') {
        researchBlock.data.subSteps.push({
          id: crypto.randomUUID(),
          type: 'searching',
          searching: [`[MCP] ${tool.name}`],
        });

        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      }

      const result = await provider.callTool(tool.name, args);

      const textContent = result.content
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text!)
        .join('\n');

      const chunk: Chunk = {
        content: textContent || JSON.stringify(result.content),
        metadata: {
          title: `MCP: ${tool.name}`,
          url: '',
        },
      };

      return {
        type: 'search_results',
        results: [chunk],
      };
    },
  };
};

const loadMCPActions = async (): Promise<ResearchAction<any>[]> => {
  const mcpConfig = configManager.getConfig('mcp');

  if (!mcpConfig?.enabled || !mcpConfig?.baseURL) {
    return [];
  }

  try {
    const provider = new MCPProvider(mcpConfig.baseURL, mcpConfig.apiKey);
    const tools = await provider.listTools();
    return tools.map((tool) => createMCPAction(tool, provider));
  } catch (err) {
    console.error('Failed to load MCP tools:', err);
    return [];
  }
};

export { loadMCPActions, createMCPAction };
