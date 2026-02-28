import z from 'zod';
import { ResearchAction } from '../../types';
import { Chunk } from '@/lib/types';
import MCPClient, { MCPTool } from '@/lib/mcp/provider';
import configManager from '@/lib/config';
import { MCPServerConfig } from '@/lib/config/types';

/** Thrown when the user denies an ask-scope tool — caught by the researcher loop */
export class McpApprovalDeniedError extends Error {
  constructor(toolName: string) {
    super(`User denied execution of MCP tool "${toolName}"`);
    this.name = 'McpApprovalDeniedError';
  }
}

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
  client: MCPClient,
  serverConfig: MCPServerConfig,
): ResearchAction<any> => {
  const schema = buildSchema(tool);

  return {
    name: tool.name,
    schema,
    getToolDescription: () => tool.description,
    getDescription: () => tool.description,
    enabled: (_config) => {
      const mcpConfig = configManager.getConfig('mcp');
      if (!Array.isArray(mcpConfig?.servers)) return false;

      const server = mcpConfig.servers.find(
        (s: MCPServerConfig) => s.id === serverConfig.id,
      );

      if (!server?.enabled) return false;

      /* Check per-tool override scope */
      const override = server.toolOverrides?.find(
        (o: { name: string; scope: string }) => o.name === tool.name,
      );
      const scope = override?.scope ?? server.defaultScope;

      return scope !== 'disabled';
    },
    execute: async (params, additionalConfig) => {
      const { type: _type, ...args } = params as any;

      /* Enforce ask scope: re-read config live so UI scope changes take effect
       * without restarting the server. */
      const liveMcpConfig = configManager.getConfig('mcp');
      const liveServer = liveMcpConfig?.servers?.find(
        (s: MCPServerConfig) => s.id === serverConfig.id,
      );
      const liveOverride = liveServer?.toolOverrides?.find(
        (o: { name: string; scope: string }) => o.name === tool.name,
      );
      const effectiveScope =
        liveOverride?.scope ?? liveServer?.defaultScope ?? 'allow';

      if (effectiveScope === 'ask') {
        /* Extract the latest reasoning from the research block so the approval
         * widget can show it to the user. */
        const currentResearchBlock = additionalConfig.session.getBlock(
          additionalConfig.researchBlockId,
        );
        const lastReasoning =
          currentResearchBlock?.type === 'research'
            ? currentResearchBlock.data.subSteps
                .findLast((s) => s.type === 'reasoning')
                ?.reasoning
            : undefined;

        /* Emit the approval-request block so the UI can render the widget. */
        const approvalBlockId = crypto.randomUUID();
        additionalConfig.session.emitBlock({
          id: approvalBlockId,
          type: 'mcp_approval',
          data: {
            sessionId: additionalConfig.session.id,
            toolName: tool.name,
            serverName: serverConfig.name,
            args,
            reasoning: lastReasoning,
            status: 'pending',
          },
        });

        /* Pause until the user approves or denies via /api/mcp/approval/[blockId] */
        const { approved, steering } =
          await additionalConfig.session.waitForApproval(approvalBlockId);

        if (!approved) {
          if (steering) {
            /* Return steering text as tool context so the LLM can act on it. */
            return {
              type: 'search_results',
              results: [
                {
                  content: `User declined to run tool "${tool.name}" from "${serverConfig.name}". User guidance: ${steering}`,
                  metadata: {
                    title: `[Tool Declined] ${serverConfig.name}: ${tool.name}`,
                    url: '',
                  },
                },
              ],
            } satisfies { type: 'search_results'; results: Chunk[] };
          }
          /* No steering — abort the research loop entirely. */
          throw new McpApprovalDeniedError(tool.name);
        }
        /* Approved — fall through to execute the tool normally. */
      }

      const researchBlock = additionalConfig.session.getBlock(
        additionalConfig.researchBlockId,
      );

      if (researchBlock && researchBlock.type === 'research') {
        researchBlock.data.subSteps.push({
          id: crypto.randomUUID(),
          type: 'searching',
          searching: [`[MCP:${serverConfig.name}] ${tool.name}`],
        });

        additionalConfig.session.updateBlock(additionalConfig.researchBlockId, [
          {
            op: 'replace',
            path: '/data/subSteps',
            value: researchBlock.data.subSteps,
          },
        ]);
      }

      const result = await client.callTool(tool.name, args);

      const textContent = result.content
        .filter((c) => c.type === 'text' && c.text)
        .map((c) => c.text!)
        .join('\n');

      const chunk: Chunk = {
        content: textContent || JSON.stringify(result.content),
        metadata: {
          title: `MCP[${serverConfig.name}]: ${tool.name}`,
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
  const servers: MCPServerConfig[] = mcpConfig?.servers ?? [];
  const enabledServers = servers.filter((s) => s.enabled);

  if (enabledServers.length === 0) return [];

  const allActions: ResearchAction<any>[] = [];

  await Promise.allSettled(
    enabledServers.map(async (serverCfg) => {
      try {
        const client = new MCPClient(serverCfg);
        const tools = await client.listTools();
        const actions = tools.map((tool) =>
          createMCPAction(tool, client, serverCfg),
        );
        allActions.push(...actions);
      } catch (err) {
        console.error(
          `Failed to load MCP tools from server "${serverCfg.name}":`,
          err,
        );
      }
    }),
  );

  return allActions;
};

export { loadMCPActions, createMCPAction };
