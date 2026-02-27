'use client';

import { UIConfigField } from '@/lib/config/types';
import SettingsField from '../SettingsField';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type MCPTool = {
  name: string;
  description: string;
};

const MCP = ({
  fields,
  values,
}: {
  fields: UIConfigField[];
  values: Record<string, any>;
}) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    tools?: MCPTool[];
    message?: string;
  } | null>(null);

  const handleTestConnection = async () => {
    const baseURLField = fields.find((f) => f.key === 'baseURL');
    const apiKeyField = fields.find((f) => f.key === 'apiKey');

    const baseURL = values['baseURL'] ?? (baseURLField as any)?.default ?? '';
    const apiKey = values['apiKey'] ?? (apiKeyField as any)?.default ?? '';

    if (!baseURL) {
      toast.error('Please set an MCP Base URL before testing the connection.');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/mcp/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseURL, apiKey }),
      });

      const data = await res.json();
      setTestResult(data);

      if (data.ok) {
        toast.success(
          `Connected successfully. Found ${data.tools?.length ?? 0} tool(s).`,
        );
      } else {
        toast.error(`Connection failed: ${data.message ?? 'Unknown error'}`);
      }
    } catch (err) {
      toast.error('Failed to test MCP connection.');
      setTestResult({ ok: false, message: 'Network error.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
      {fields.map((field) => (
        <SettingsField
          key={field.key}
          field={field}
          value={values[field.key] ?? (field as any).default}
          dataAdd="mcp"
        />
      ))}

      <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
        <div className="flex flex-col space-y-3">
          <div>
            <h4 className="text-sm text-black dark:text-white">
              Test Connection
            </h4>
            <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
              Verify that Perplexica can reach your MCP server and discover its
              tools.
            </p>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center space-x-2 rounded-lg bg-light-200 dark:bg-dark-200 px-4 py-2 text-xs text-black/70 dark:text-white/70 hover:text-black dark:hover:text-white hover:bg-light-300 dark:hover:bg-dark-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed w-fit"
          >
            {testing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{testing ? 'Testing…' : 'Test Connection'}</span>
          </button>

          {testResult && (
            <div
              className={`rounded-lg px-4 py-3 text-xs ${
                testResult.ok
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              {testResult.ok ? (
                <div className="space-y-1">
                  <p className="font-medium">
                    ✓ Connected — {testResult.tools?.length ?? 0} tool(s)
                    available
                  </p>
                  {testResult.tools && testResult.tools.length > 0 && (
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-80">
                      {testResult.tools.map((t) => (
                        <li key={t.name}>
                          <span className="font-mono">{t.name}</span>
                          {t.description && ` — ${t.description}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p>✗ {testResult.message ?? 'Connection failed.'}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default MCP;
