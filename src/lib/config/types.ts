import { Model } from '../models/types';

type BaseUIConfigField = {
  name: string;
  key: string;
  required: boolean;
  description: string;
  scope: 'client' | 'server';
  env?: string;
};

type StringUIConfigField = BaseUIConfigField & {
  type: 'string';
  placeholder?: string;
  default?: string;
};

type SelectUIConfigFieldOptions = {
  name: string;
  value: string;
};

type SelectUIConfigField = BaseUIConfigField & {
  type: 'select';
  default?: string;
  options: SelectUIConfigFieldOptions[];
};

type PasswordUIConfigField = BaseUIConfigField & {
  type: 'password';
  placeholder?: string;
  default?: string;
};

type TextareaUIConfigField = BaseUIConfigField & {
  type: 'textarea';
  placeholder?: string;
  default?: string;
};

type SwitchUIConfigField = BaseUIConfigField & {
  type: 'switch';
  default?: boolean;
};

type UIConfigField =
  | StringUIConfigField
  | SelectUIConfigField
  | PasswordUIConfigField
  | TextareaUIConfigField
  | SwitchUIConfigField;

type ConfigModelProvider = {
  id: string;
  name: string;
  type: string;
  chatModels: Model[];
  embeddingModels: Model[];
  config: { [key: string]: any };
  hash: string;
};

type MCPToolScope = 'allow' | 'ask' | 'disabled';

type MCPToolOverride = {
  name: string;
  scope: MCPToolScope;
};

type MCPServerTransportStdio = {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

type MCPServerTransportHttp = {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
};

type MCPServerTransport = MCPServerTransportStdio | MCPServerTransportHttp;

type MCPServerConfig = {
  id: string;
  name: string;
  enabled: boolean;
  defaultScope: MCPToolScope;
  toolOverrides: MCPToolOverride[];
  systemPromptSnippet?: string;
  transport: MCPServerTransport;
};

type MCPConfig = {
  servers: MCPServerConfig[];
};

type Config = {
  version: number;
  setupComplete: boolean;
  preferences: {
    [key: string]: any;
  };
  personalization: {
    [key: string]: any;
  };
  modelProviders: ConfigModelProvider[];
  search: {
    [key: string]: any;
  };
  mcp: MCPConfig;
};

type EnvMap = {
  [key: string]: {
    fieldKey: string;
    providerKey: string;
  };
};

type ModelProviderUISection = {
  name: string;
  key: string;
  fields: UIConfigField[];
};

type UIConfigSections = {
  preferences: UIConfigField[];
  personalization: UIConfigField[];
  modelProviders: ModelProviderUISection[];
  search: UIConfigField[];
  mcp: UIConfigField[];
};

export type {
  UIConfigField,
  Config,
  EnvMap,
  UIConfigSections,
  SelectUIConfigField,
  StringUIConfigField,
  ModelProviderUISection,
  ConfigModelProvider,
  TextareaUIConfigField,
  SwitchUIConfigField,
  MCPConfig,
  MCPServerConfig,
  MCPServerTransport,
  MCPServerTransportStdio,
  MCPServerTransportHttp,
  MCPToolScope,
  MCPToolOverride,
};
