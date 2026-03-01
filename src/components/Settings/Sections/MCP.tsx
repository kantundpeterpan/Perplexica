'use client';

import {
  MCPServerConfig,
  MCPServerTransport,
  MCPToolOverride,
  MCPToolScope,
} from '@/lib/config/types';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog, DialogPanel } from '@headlessui/react';
import { Switch } from '@headlessui/react';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  PlugZap,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
} from 'lucide-react';

type TransportForm =
  | { type: 'http'; url: string; headers: string }
  | { type: 'stdio'; command: string; args: string; env: string };

const defaultHttpForm = (): TransportForm => ({ type: 'http', url: '', headers: '' });
const defaultStdioForm = (): TransportForm => ({ type: 'stdio', command: '', args: '', env: '' });

const parseTransportForm = (form: TransportForm): MCPServerTransport => {
  if (form.type === 'http') {
    let headers: Record<string, string> = {};
    if (form.headers.trim()) {
      try { headers = JSON.parse(form.headers); }
      catch { throw new Error('Headers must be valid JSON (e.g. {"Authorization":"Bearer sk-..."})'); }
    }
    return { type: 'http', url: form.url.trim(), ...(Object.keys(headers).length ? { headers } : {}) };
  }
  const args = form.args.trim() ? form.args.trim().split(/\s+/) : [];
  let env: Record<string, string> = {};
  if (form.env.trim()) {
    try { env = JSON.parse(form.env); }
    catch { throw new Error('Env must be valid JSON (e.g. {"KEY":"value"})'); }
  }
  return {
    type: 'stdio',
    command: form.command.trim(),
    ...(args.length ? { args } : {}),
    ...(Object.keys(env).length ? { env } : {}),
  };
};

const inputCls =
  'w-full rounded-lg border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary px-4 py-3 text-[13px] text-black/80 dark:text-white/80 placeholder:text-black/40 dark:placeholder:text-white/40 focus-visible:outline-none transition-colors disabled:opacity-60';

/* ──────────────── Add/Edit server dialog ──────────────── */
const ServerFormDialog = ({
  existing,
  onClose,
  onSaved,
}: {
  existing?: MCPServerConfig;
  onClose: () => void;
  onSaved: (server: MCPServerConfig) => void;
}) => {
  const [name, setName] = useState(existing?.name ?? '');
  const [defaultScope, setDefaultScope] = useState<MCPToolScope>(existing?.defaultScope ?? 'allow');
  const [systemPromptSnippet, setSystemPromptSnippet] = useState(existing?.systemPromptSnippet ?? '');
  const [transportForm, setTransportForm] = useState<TransportForm>(() => {
    if (!existing) return defaultHttpForm();
    const t = existing.transport;
    if (t.type === 'http') return { type: 'http', url: t.url, headers: t.headers ? JSON.stringify(t.headers, null, 2) : '' };
    return { type: 'stdio', command: t.command, args: (t.args ?? []).join(' '), env: t.env ? JSON.stringify(t.env, null, 2) : '' };
  });
  const [testResult, setTestResult] = useState<{ ok: boolean; tools?: { name: string; description: string }[]; message?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registrySlug, setRegistrySlug] = useState('');
  const [loadingRegistry, setLoadingRegistry] = useState(false);

  const handleRegistryImport = async () => {
    const slug = registrySlug.trim();
    if (!slug) { toast.error('Enter a registry slug first.'); return; }
    setLoadingRegistry(true);
    try {
      const res = await fetch(`/api/mcp/registry?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok || !data.transport) { toast.error(data.message ?? 'Registry lookup failed or no transport found.'); return; }
      if (!name) setName(data.name ?? slug);
      const t = data.transport as MCPServerTransport;
      if (t.type === 'http') setTransportForm({ type: 'http', url: t.url, headers: t.headers ? JSON.stringify(t.headers, null, 2) : '' });
      else setTransportForm({ type: 'stdio', command: t.command, args: (t.args ?? []).join(' '), env: t.env ? JSON.stringify(t.env, null, 2) : '' });
      toast.success(`Loaded "${data.name ?? slug}" from registry.`);
    } catch (err: any) { toast.error(err?.message ?? 'Registry lookup failed.'); }
    finally { setLoadingRegistry(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const transport = parseTransportForm(transportForm);
      const res = await fetch('/api/mcp/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transport }) });
      const data = await res.json();
      setTestResult(data);
      if (data.ok) toast.success(`Connected \u2014 ${data.tools?.length ?? 0} tool(s) found`);
      else toast.error(`Connection failed: ${data.message ?? 'Unknown error'}`);
    } catch (err: any) { toast.error(err?.message ?? 'Failed to test connection'); setTestResult({ ok: false, message: err?.message }); }
    finally { setTesting(false); }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Server name is required.'); return; }
    setSaving(true);
    try {
      const transport = parseTransportForm(transportForm);
      const payload = { name, transport, defaultScope, systemPromptSnippet: systemPromptSnippet.trim() };
      let res: Response;
      if (existing) res = await fetch(`/api/mcp/servers/${existing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      else res = await fetch('/api/mcp/servers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Failed to save server.');
      const data = await res.json();
      onSaved(data.server);
      toast.success(existing ? 'Server updated.' : 'Server added.');
      onClose();
    } catch (err: any) { toast.error(err?.message ?? 'Failed to save server'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog static open onClose={onClose} className="relative z-[60]">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="fixed inset-0 flex w-screen items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
        <DialogPanel className="w-full mx-4 lg:w-[600px] max-h-[90vh] flex flex-col border bg-light-primary dark:bg-dark-primary border-light-secondary dark:border-dark-secondary rounded-lg overflow-hidden">
          <div className="px-6 pt-6 pb-4 flex-shrink-0">
            <h3 className="text-black/90 dark:text-white/90 font-medium text-sm">{existing ? 'Edit MCP Server' : 'Add MCP Server'}</h3>
          </div>
          <div className="border-t border-light-200 dark:border-dark-200 flex-shrink-0" />
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {!existing && (
              <div className="flex flex-col space-y-1.5">
                <label className="text-xs text-black/70 dark:text-white/70">Import from MCP Registry (optional)</label>
                <div className="flex gap-2">
                  <input value={registrySlug} onChange={(e) => setRegistrySlug(e.target.value)} className={inputCls} placeholder="e.g., filesystem or brave-search" onKeyDown={(e) => e.key === 'Enter' && handleRegistryImport()} />
                  <button type="button" onClick={handleRegistryImport} disabled={loadingRegistry} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition-colors disabled:opacity-60 shrink-0">
                    {loadingRegistry ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}Lookup
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-black/70 dark:text-white/70">Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g., My Filesystem Server" />
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-black/70 dark:text-white/70">Transport type</label>
              <div className="flex gap-2">
                {(['http', 'stdio'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTransportForm(t === 'http' ? defaultHttpForm() : defaultStdioForm())} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${transportForm.type === t ? 'bg-sky-500 border-sky-500 text-white' : 'border-light-200 dark:border-dark-200 text-black/60 dark:text-white/60 hover:bg-light-200 dark:hover:bg-dark-200'}`}>
                    {t === 'http' ? 'HTTP (remote)' : 'stdio (local)'}
                  </button>
                ))}
              </div>
            </div>
            {transportForm.type === 'http' && (
              <>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs text-black/70 dark:text-white/70">URL *</label>
                  <input value={transportForm.url} onChange={(e) => { const v = e.target.value; setTransportForm((f) => f.type === 'http' ? { ...f, url: v } : f); }} className={inputCls} placeholder="https://example.com/mcp" />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs text-black/70 dark:text-white/70">Headers (JSON, optional)</label>
                  <textarea value={transportForm.headers} onChange={(e) => { const v = e.target.value; setTransportForm((f) => f.type === 'http' ? { ...f, headers: v } : f); }} className={inputCls + ' font-mono text-[11px]'} placeholder='{"Authorization": "Bearer sk-..."}' rows={3} />
                </div>
              </>
            )}
            {transportForm.type === 'stdio' && (
              <>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs text-black/70 dark:text-white/70">Command *</label>
                  <input value={transportForm.command} onChange={(e) => { const v = e.target.value; setTransportForm((f) => f.type === 'stdio' ? { ...f, command: v } : f); }} className={inputCls + ' font-mono'} placeholder="npx" />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs text-black/70 dark:text-white/70">Arguments (space-separated)</label>
                  <input value={transportForm.args} onChange={(e) => { const v = e.target.value; setTransportForm((f) => f.type === 'stdio' ? { ...f, args: v } : f); }} className={inputCls + ' font-mono'} placeholder="-y @modelcontextprotocol/server-filesystem /tmp" />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs text-black/70 dark:text-white/70">Environment variables (JSON, optional)</label>
                  <textarea value={transportForm.env} onChange={(e) => { const v = e.target.value; setTransportForm((f) => f.type === 'stdio' ? { ...f, env: v } : f); }} className={inputCls + ' font-mono text-[11px]'} placeholder='{"API_KEY": "..."}' rows={3} />
                </div>
              </>
            )}
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-black/70 dark:text-white/70">Default tool scope</label>
              <div className="flex gap-2 flex-wrap">
                {(['allow', 'ask', 'disabled'] as MCPToolScope[]).map((s) => (
                  <button key={s} type="button" onClick={() => setDefaultScope(s)} className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${defaultScope === s ? 'bg-sky-500 border-sky-500 text-white' : 'border-light-200 dark:border-dark-200 text-black/60 dark:text-white/60 hover:bg-light-200 dark:hover:bg-dark-200'}`}>
                    {s === 'allow' ? 'Allow (automatic)' : s === 'ask' ? 'Ask (approval)' : 'Disabled'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col space-y-1.5">
              <label className="text-xs text-black/70 dark:text-white/70">System prompt snippet (optional)</label>
              <textarea value={systemPromptSnippet} onChange={(e) => setSystemPromptSnippet(e.target.value)} className={inputCls + ' text-[12px]'} placeholder="Describe when and how the agent should use this server's tools. This text is injected into the system prompt." rows={3} />
            </div>
            {testResult && (
              <div className={`rounded-lg px-4 py-3 text-xs ${testResult.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                {testResult.ok ? (
                  <div className="space-y-1">
                    <p className="font-medium">\u2713 Connected \u2014 {testResult.tools?.length ?? 0} tool(s)</p>
                    {testResult.tools && testResult.tools.length > 0 && (
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-80">
                        {testResult.tools.map((t) => (<li key={t.name}><span className="font-mono">{t.name}</span>{t.description && ` \u2014 ${t.description}`}</li>))}
                      </ul>
                    )}
                  </div>
                ) : <p>\u2717 {testResult.message ?? 'Connection failed.'}</p>}
              </div>
            )}
          </div>
          <div className="border-t border-light-200 dark:border-dark-200 flex-shrink-0" />
          <div className="px-6 py-4 flex justify-between items-center flex-shrink-0">
            <button type="button" onClick={handleTest} disabled={testing} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition-colors disabled:opacity-60">
              {testing && <Loader2 className="h-3 w-3 animate-spin" />}{testing ? 'Testing\u2026' : 'Test connection'}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] border border-light-200 dark:border-dark-200 text-black/70 dark:text-white/70 hover:bg-light-200 dark:hover:bg-dark-200 transition-colors">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-[13px] bg-sky-500 text-white font-medium disabled:opacity-85 hover:opacity-85 active:scale-95 transition duration-200 flex items-center gap-1.5">
                {saving && <Loader2 className="h-3 w-3 animate-spin" />}{existing ? 'Save changes' : 'Add server'}
              </button>
            </div>
          </div>
        </DialogPanel>
      </motion.div>
    </Dialog>
  );
};

/* ──────────────── Scope picker ──────────────── */
const scopeLabel: Record<MCPToolScope, string> = { allow: 'Allow', ask: 'Ask', disabled: 'Off' };
const scopeColor: Record<MCPToolScope, string> = {
  allow: 'bg-green-500/10 text-green-600 dark:text-green-400',
  ask: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  disabled: 'bg-light-200 dark:bg-dark-200 text-black/40 dark:text-white/40',
};

const ScopePicker = ({ scope, onChange }: { scope: MCPToolScope; onChange: (s: MCPToolScope) => void }) => (
  <div className="flex gap-1">
    {(['allow', 'ask', 'disabled'] as MCPToolScope[]).map((s) => (
      <button key={s} onClick={() => onChange(s)} className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${scope === s ? scopeColor[s] + ' ring-1 ring-inset ring-current' : 'text-black/40 dark:text-white/40 hover:bg-light-200 dark:hover:bg-dark-200'}`}>
        {scopeLabel[s]}
      </button>
    ))}
  </div>
);

/* ──────────────── Tool row (inside expanded server card) ──────────────── */
type MCPToolEntry = { name: string; description: string };

const ToolRow = ({ tool, override, defaultScope, onScopeChange }: { tool: MCPToolEntry; override?: MCPToolOverride; defaultScope: MCPToolScope; onScopeChange: (name: string, scope: MCPToolScope) => void | Promise<void> }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-light-200/60 dark:border-dark-200/60 last:border-0">
    <div className="flex flex-col min-w-0">
      <span className="text-xs font-mono text-black/80 dark:text-white/80 truncate">{tool.name}</span>
      {tool.description && <span className="text-[11px] text-black/40 dark:text-white/40 truncate mt-0.5">{tool.description}</span>}
    </div>
    <ScopePicker scope={override?.scope ?? defaultScope} onChange={(s) => onScopeChange(tool.name, s)} />
  </div>
);

/* ──────────────── Server card ──────────────── */
const ServerCard = ({ server, onUpdated, onDeleted }: { server: MCPServerConfig; onUpdated: (s: MCPServerConfig) => void; onDeleted: (id: string) => void }) => {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [tools, setTools] = useState<MCPToolEntry[] | null>(null);
  const [loadingTools, setLoadingTools] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setTogglingEnabled(true);
    try {
      const res = await fetch(`/api/mcp/servers/${server.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      onUpdated(data.server);
    } catch { toast.error('Failed to update server.'); }
    finally { setTogglingEnabled(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/mcp/servers/${server.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).message);
      onDeleted(server.id);
      toast.success('Server removed.');
    } catch { toast.error('Failed to remove server.'); }
    finally { setDeleting(false); }
  };

  const loadTools = useCallback(async () => {
    if (tools !== null) return;
    setLoadingTools(true);
    try {
      const res = await fetch(`/api/mcp/servers/${server.id}/tools`);
      const data = await res.json();
      setTools(data.tools ?? []);
    } catch { setTools([]); toast.error('Failed to load tools.'); }
    finally { setLoadingTools(false); }
  }, [server.id, tools]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadTools();
  };

  const handleScopeChange = async (toolName: string, scope: MCPToolScope) => {
    const current = server.toolOverrides ?? [];
    let updated: MCPToolOverride[];
    if (scope === server.defaultScope) updated = current.filter((o) => o.name !== toolName);
    else {
      const ex = current.find((o) => o.name === toolName);
      updated = ex ? current.map((o) => (o.name === toolName ? { ...o, scope } : o)) : [...current, { name: toolName, scope }];
    }
    try {
      const res = await fetch(`/api/mcp/servers/${server.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toolOverrides: updated }) });
      if (!res.ok) throw new Error((await res.json()).message);
      const data = await res.json();
      onUpdated(data.server);
    } catch { toast.error('Failed to save scope change.'); }
  };

  const transportLabel = server.transport.type === 'http' ? server.transport.url : `${server.transport.command} ${(server.transport.args ?? []).join(' ')}`;

  return (
    <>
      {editing && (
        <AnimatePresence>
          <ServerFormDialog existing={server} onClose={() => setEditing(false)} onSaved={(updated) => { onUpdated(updated); setEditing(false); }} />
        </AnimatePresence>
      )}
      <div className="border border-light-200 dark:border-dark-200 rounded-lg overflow-hidden bg-light-primary dark:bg-dark-primary">
        <div className="px-5 py-3.5 flex flex-row justify-between items-center border-b border-light-200 dark:border-dark-200 bg-light-secondary/30 dark:bg-dark-secondary/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-sky-500/10"><PlugZap size={14} className="text-sky-500" /></div>
            <div className="flex flex-col">
              <p className="text-sm text-black dark:text-white font-medium">{server.name}</p>
              <p className="text-[10px] text-black/50 dark:text-white/50 font-mono truncate max-w-[200px]">[{server.transport.type}] {transportLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={server.enabled} onChange={handleToggle} disabled={togglingEnabled} className="group relative flex h-5 w-10 shrink-0 cursor-pointer rounded-full bg-light-200 dark:bg-white/10 p-0.5 transition-colors disabled:opacity-60 data-[checked]:bg-sky-500">
              <span className="pointer-events-none inline-block size-4 translate-x-0 rounded-full bg-white shadow transition duration-200 ease-in-out group-data-[checked]:translate-x-5" />
            </Switch>
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg hover:bg-light-200 dark:hover:bg-dark-200 text-black/50 dark:text-white/50 transition-colors"><Pencil size={14} /></button>
            <button onClick={handleDelete} disabled={deleting} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-black/50 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-60">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        </div>
        <button onClick={handleExpand} className="w-full px-5 py-2.5 flex items-center justify-between text-xs text-black/50 dark:text-white/50 hover:bg-light-secondary/20 dark:hover:bg-dark-secondary/20 transition-colors">
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              {server.enabled ? <CheckCircle size={11} className="text-green-500" /> : <XCircle size={11} className="text-black/30 dark:text-white/30" />}
              {server.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <span>&middot;</span>
            <span>Default: {scopeLabel[server.defaultScope]}</span>
            {server.toolOverrides && server.toolOverrides.length > 0 && (
              <><span>&middot;</span><span>{server.toolOverrides.length} override{server.toolOverrides.length !== 1 ? 's' : ''}</span></>
            )}
          </span>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden border-t border-light-200 dark:border-dark-200">
              <div className="px-5 py-3">
                {loadingTools ? (
                  <div className="flex items-center gap-2 text-xs text-black/40 dark:text-white/40 py-2"><Loader2 size={12} className="animate-spin" />Loading tools&hellip;</div>
                ) : tools === null || tools.length === 0 ? (
                  <p className="text-xs text-black/40 dark:text-white/40 py-1">{tools === null ? 'Could not load tools.' : 'No tools available from this server.'}</p>
                ) : (
                  <div>
                    <p className="text-[10px] font-medium text-black/40 dark:text-white/40 uppercase tracking-wide mb-2">Tools ({tools.length})</p>
                    {tools.map((tool) => (
                      <ToolRow key={tool.name} tool={tool} override={server.toolOverrides?.find((o) => o.name === tool.name)} defaultScope={server.defaultScope} onScopeChange={handleScopeChange} />
                    ))}
                  </div>
                )}
                {server.systemPromptSnippet && (
                  <div className="mt-3 pt-3 border-t border-light-200/60 dark:border-dark-200/60">
                    <p className="text-[10px] font-medium text-black/40 dark:text-white/40 uppercase tracking-wide mb-1">Prompt snippet</p>
                    <p className="text-[11px] text-black/60 dark:text-white/60 whitespace-pre-wrap">{server.systemPromptSnippet}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

/* ──────────────── Main MCP section ──────────────── */
const MCP = ({
  values,
}: {
  fields: any[];
  values: { servers?: MCPServerConfig[] };
}) => {
  const [servers, setServers] = useState<MCPServerConfig[]>(values?.servers ?? []);
  const [adding, setAdding] = useState(false);
  const [reloading, setReloading] = useState(false);

  const handleReload = async () => {
    setReloading(true);
    try {
      const res = await fetch('/api/mcp/servers');
      const data = await res.json();
      setServers(data.servers ?? []);
      toast.success('Server list reloaded.');
    } catch { toast.error('Failed to reload servers.'); }
    finally { setReloading(false); }
  };

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <div className="flex flex-row justify-between items-center px-6 mb-4">
        <p className="text-xs text-black/70 dark:text-white/70">Manage MCP servers</p>
        <div className="flex items-center gap-2">
          <button onClick={handleReload} disabled={reloading} className="p-1.5 rounded-lg text-black/50 dark:text-white/50 hover:bg-light-200 dark:hover:bg-dark-200 transition-colors disabled:opacity-60" title="Reload servers">
            <RefreshCw size={14} className={reloading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setAdding(true)} className="px-3 py-1.5 rounded-lg text-xs border border-light-200 dark:border-dark-200 text-black dark:text-white bg-light-secondary/50 dark:bg-dark-secondary/50 hover:bg-light-secondary hover:dark:bg-dark-secondary flex items-center gap-1.5 active:scale-95 transition duration-200">
            <Plus className="w-3.5 h-3.5" />Add Server
          </button>
        </div>
      </div>
      <div className="flex flex-col px-6 gap-y-3">
        {servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-lg border-2 border-dashed border-light-200 dark:border-dark-200 bg-light-secondary/10 dark:bg-dark-secondary/10">
            <PlugZap size={32} className="text-sky-500 mb-3 opacity-60" />
            <p className="text-sm font-medium text-black/70 dark:text-white/70 mb-1">No MCP servers configured</p>
            <p className="text-xs text-black/50 dark:text-white/50 text-center max-w-sm">
              Add an HTTP or stdio MCP server to extend Perplexica with external tools.
              Supports any MCP-compliant server \u2014 or import from the{' '}
              <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-black/70 dark:hover:text-white/70">
                MCP registry
              </a>.
            </p>
          </div>
        ) : (
          servers.map((server) => (
            <ServerCard key={server.id} server={server} onUpdated={(updated) => setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))} onDeleted={(id) => setServers((prev) => prev.filter((s) => s.id !== id))} />
          ))
        )}
      </div>
      <AnimatePresence>
        {adding && (
          <ServerFormDialog onClose={() => setAdding(false)} onSaved={(server) => { setServers((prev) => [...prev, server]); setAdding(false); }} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MCP;
