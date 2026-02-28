'use client';

import { useState, useEffect } from 'react';
import { Settings2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChat } from '@/lib/hooks/useChat';
import { AnimatePresence, motion } from 'motion/react';

type ToolEntry = {
  name: string;
  description: string;
  server?: string;
};

/**
 * Panel showing all available MCP/research tools for this session.
 * Users can toggle individual tools on/off; changes apply immediately
 * to the next message in the current session only.
 */
const SessionToolPanel = () => {
  const { sessionMcpConfig, setSessionMcpConfig } = useChat();
  const [open, setOpen] = useState(false);
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/mcp/tools')
      .then((r) => r.json())
      .then((data: { tools?: ToolEntry[] }) => {
        setTools(data.tools ?? []);
      })
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, [open]);

  const disabledTools: string[] = sessionMcpConfig.disabledTools ?? [];

  const toggleTool = (toolName: string) => {
    const next = disabledTools.includes(toolName)
      ? disabledTools.filter((t) => t !== toolName)
      : [...disabledTools, toolName];
    setSessionMcpConfig({ ...sessionMcpConfig, disabledTools: next });
  };

  const isEnabled = (toolName: string) => !disabledTools.includes(toolName);

  const activeDisabledCount = disabledTools.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-xs transition-colors duration-150',
          activeDisabledCount > 0
            ? 'border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
            : 'border-light-200 dark:border-dark-200 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white',
        )}
        title="Per-session tool settings"
      >
        <Settings2 size={13} />
        <span>Tools</span>
        {activeDisabledCount > 0 && (
          <span className="ml-0.5 font-semibold">({activeDisabledCount} off)</span>
        )}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            className="absolute bottom-full mb-2 left-0 z-50 w-72 bg-light-primary dark:bg-dark-primary border border-light-200 dark:border-dark-200 rounded-xl shadow-lg p-3"
          >
            <p className="text-xs font-semibold text-black dark:text-white mb-2">
              Session Tools
            </p>
            <p className="text-[11px] text-black/50 dark:text-white/50 mb-3 leading-relaxed">
              Toggle tools on/off for this session only. Changes take effect on
              the next message.
            </p>

            {loading && (
              <p className="text-xs text-black/40 dark:text-white/40 py-2 text-center">
                Loading tools…
              </p>
            )}

            {!loading && tools.length === 0 && (
              <p className="text-xs text-black/40 dark:text-white/40 py-2 text-center">
                No MCP tools configured.
              </p>
            )}

            <div className="flex flex-col space-y-1 max-h-52 overflow-y-auto">
              {tools.map((tool) => (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => toggleTool(tool.name)}
                  className={cn(
                    'flex items-center justify-between w-full px-2.5 py-2 rounded-lg text-left transition-colors duration-100',
                    isEnabled(tool.name)
                      ? 'bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200'
                      : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30',
                  )}
                >
                  <div className="flex flex-col flex-1 min-w-0 pr-2">
                    <span className="text-xs font-medium text-black dark:text-white truncate">
                      {tool.name}
                      {tool.server && (
                        <span className="ml-1 text-[10px] text-black/40 dark:text-white/40 font-normal">
                          [{tool.server}]
                        </span>
                      )}
                    </span>
                    {tool.description && (
                      <span className="text-[10px] text-black/50 dark:text-white/50 line-clamp-1 mt-0.5">
                        {tool.description}
                      </span>
                    )}
                  </div>
                  {isEnabled(tool.name) ? (
                    <ToggleRight size={18} className="text-sky-500 flex-shrink-0" />
                  ) : (
                    <ToggleLeft size={18} className="text-black/30 dark:text-white/30 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {disabledTools.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setSessionMcpConfig({ ...sessionMcpConfig, disabledTools: [] })
                }
                className="mt-3 w-full text-center text-[11px] text-sky-500 hover:text-sky-600 transition-colors"
              >
                Re-enable all tools
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SessionToolPanel;
