import z from 'zod';
import BaseLLM from '../../models/base/llm';
import BaseEmbedding from '@/lib/models/base/embedding';
import SessionManager from '@/lib/session';
import { ChatTurnMessage, Chunk } from '@/lib/types';

export type SearchSources = 'web' | 'discussions' | 'academic';

/**
 * Per-session SearxNG configuration.
 * When provided, these values override the global SearxNG settings for the
 * current chat session only.
 */
export type SearxngSessionConfig = {
  /** SearxNG instance base URL (e.g. "http://localhost:8888"). */
  instanceUrl?: string;
  /** Request timeout in milliseconds. */
  timeout?: number;
  /** Maximum number of results to return. */
  maxResults?: number;
  /** Safe-search level: 0 = off, 1 = moderate, 2 = strict. */
  safeSearch?: 0 | 1 | 2;
};

/**
 * Session-scoped MCP tool configuration.
 * Allows per-session overrides of which tools are enabled and how they are
 * configured, without affecting the global/default tool settings.
 */
export type SessionMcpConfig = {
  /**
   * Names of tools that should be disabled for this session.
   * Tool names match the `name` field on each `ResearchAction` / MCP tool
   * (e.g. `"web_search"`, `"academic_search"`).
   */
  disabledTools?: string[];
  /** Per-session SearxNG settings. */
  searxng?: SearxngSessionConfig;
};

export type SearchAgentConfig = {
  sources: SearchSources[];
  fileIds: string[];
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
  mode: 'speed' | 'balanced' | 'quality';
  systemInstructions: string;
  /** When set to `'chat'` the agent responds conversationally.
   *  Defaults to `'research'` (existing behaviour). */
  chatMode?: 'chat' | 'research';
  /** Custom system prompt for chat mode. Overrides the built-in chat prompt
   *  when provided. Configurable via Settings → Personalization. */
  chatSystemPrompt?: string;
  /** Session-level MCP tool overrides.  Takes precedence over global config. */
  sessionMcpConfig?: SessionMcpConfig;
};

export type SearchAgentInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  config: SearchAgentConfig;
  chatId: string;
  messageId: string;
};

export type WidgetInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  classification: ClassifierOutput;
  llm: BaseLLM<any>;
};

export type Widget = {
  type: string;
  shouldExecute: (classification: ClassifierOutput) => boolean;
  execute: (input: WidgetInput) => Promise<WidgetOutput | void>;
};

export type WidgetOutput = {
  type: string;
  llmContext: string;
  data: any;
};

export type ClassifierInput = {
  llm: BaseLLM<any>;
  enabledSources: SearchSources[];
  query: string;
  chatHistory: ChatTurnMessage[];
};

export type ClassifierOutput = {
  classification: {
    skipSearch: boolean;
    personalSearch: boolean;
    academicSearch: boolean;
    discussionSearch: boolean;
    showWeatherWidget: boolean;
    showStockWidget: boolean;
    showCalculationWidget: boolean;
  };
  standaloneFollowUp: string;
};

export type AdditionalConfig = {
  llm: BaseLLM<any>;
  embedding: BaseEmbedding<any>;
  session: SessionManager;
  /** Session-level MCP tool overrides forwarded to tool `execute()` calls. */
  sessionMcpConfig?: SessionMcpConfig;
};

export type ResearcherInput = {
  chatHistory: ChatTurnMessage[];
  followUp: string;
  classification: ClassifierOutput;
  config: SearchAgentConfig;
};

export type ResearcherOutput = {
  findings: ActionOutput[];
  searchFindings: Chunk[];
};

export type SearchActionOutput = {
  type: 'search_results';
  results: Chunk[];
};

export type DoneActionOutput = {
  type: 'done';
};

export type ReasoningResearchAction = {
  type: 'reasoning';
  reasoning: string;
};

export type ActionOutput =
  | SearchActionOutput
  | DoneActionOutput
  | ReasoningResearchAction;

export interface ResearchAction<
  TSchema extends z.ZodObject<any> = z.ZodObject<any>,
> {
  name: string;
  schema: z.ZodObject<any>;
  getToolDescription: (config: { mode: SearchAgentConfig['mode'] }) => string;
  getDescription: (config: { mode: SearchAgentConfig['mode'] }) => string;
  enabled: (config: {
    classification: ClassifierOutput;
    fileIds: string[];
    mode: SearchAgentConfig['mode'];
    sources: SearchSources[];
  }) => boolean;
  execute: (
    params: z.infer<TSchema>,
    additionalConfig: AdditionalConfig & {
      researchBlockId: string;
      fileIds: string[];
    },
  ) => Promise<ActionOutput>;
}
