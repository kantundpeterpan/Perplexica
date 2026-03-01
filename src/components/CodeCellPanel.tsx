'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  PlayIcon,
  CheckIcon,
  CopyIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TerminalIcon,
  AlertTriangleIcon,
} from 'lucide-react';
import { CodeCell } from '@/lib/hooks/useChat';
import CodeBlock from './MessageRenderer/CodeBlock';

const RUNNABLE_LANGUAGES = new Set([
  'python',
  'python3',
  'javascript',
  'js',
]);

type RunState = {
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: string;
} | null;

const CellRunOutput = ({ run }: { run: NonNullable<RunState> }) => {
  const hasOutput = run.stdout || run.stderr;
  return (
    <div className="mt-2 rounded-lg border border-light-200 dark:border-dark-200 overflow-hidden text-xs font-mono">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-light-secondary dark:bg-dark-secondary border-b border-light-200 dark:border-dark-200">
        <TerminalIcon size={12} className="text-black/50 dark:text-white/50" />
        <span className="text-black/50 dark:text-white/50 text-xs">
          Output &middot; {run.timestamp}
        </span>
        <span
          className={cn(
            'ml-auto text-xs font-semibold',
            run.exitCode === 0
              ? 'text-green-500 dark:text-green-400'
              : 'text-red-500 dark:text-red-400',
          )}
        >
          exit {run.exitCode}
        </span>
      </div>
      {hasOutput ? (
        <pre className="p-3 overflow-x-auto whitespace-pre-wrap break-words text-black dark:text-white bg-light-primary dark:bg-dark-primary">
          {run.stdout && <span>{run.stdout}</span>}
          {run.stderr && (
            <span className="text-red-600 dark:text-red-400">{run.stderr}</span>
          )}
        </pre>
      ) : (
        <p className="p-3 text-black/40 dark:text-white/40 italic">No output</p>
      )}
    </div>
  );
};

/** Confirmation banner shown the first time a user tries to run code. */
const RunWarningBanner = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) => (
  <div className="mt-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 text-xs">
    <div className="flex items-start gap-2">
      <AlertTriangleIcon
        size={14}
        className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
      />
      <p className="text-yellow-800 dark:text-yellow-200 leading-relaxed">
        This will execute the code on the server. Only run code you trust.
      </p>
    </div>
    <div className="flex gap-2 mt-2">
      <button
        onClick={onConfirm}
        className="px-3 py-1 rounded-md bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-medium transition-colors"
      >
        Run anyway
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1 rounded-md bg-light-secondary dark:bg-dark-secondary hover:bg-light-200 dark:hover:bg-dark-200 text-black dark:text-white text-xs font-medium transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
);

const SingleCodeCell = ({
  cell,
  index,
  executionAcknowledged,
  onAcknowledge,
}: {
  cell: CodeCell;
  index: number;
  executionAcknowledged: boolean;
  onAcknowledge: () => void;
}) => {
  const [runState, setRunState] = useState<RunState>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingRun, setPendingRun] = useState(false);
  const isRunnable = RUNNABLE_LANGUAGES.has(cell.language.toLowerCase());

  const executeRun = async () => {
    setIsRunning(true);
    setPendingRun(false);
    try {
      const res = await fetch('/api/code/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cell.code, language: cell.language }),
      });
      const data = await res.json();
      setRunState({
        stdout: data.stdout ?? '',
        stderr: data.stderr ?? '',
        exitCode: data.exitCode ?? 0,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch {
      setRunState({
        stdout: '',
        stderr: 'Failed to connect to code runner.',
        exitCode: 1,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunClick = () => {
    if (isRunning) return;
    if (!executionAcknowledged) {
      setPendingRun(true);
    } else {
      executeRun();
    }
  };

  const handleConfirm = () => {
    onAcknowledge();
    executeRun();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(cell.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-light-200 dark:border-dark-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-light-secondary dark:bg-dark-secondary border-b border-light-200 dark:border-dark-200">
        <span className="text-xs font-mono font-semibold text-black/60 dark:text-white/60 bg-light-primary dark:bg-dark-primary px-2 py-0.5 rounded-md border border-light-200 dark:border-dark-200">
          {cell.language || 'text'}
        </span>
        <span className="text-xs text-black/40 dark:text-white/40">
          Cell {index + 1}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {isRunnable && (
            <button
              onClick={handleRunClick}
              disabled={isRunning}
              title="Run code"
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors duration-200',
                isRunning
                  ? 'bg-light-200 dark:bg-dark-200 text-black/40 dark:text-white/40 cursor-not-allowed'
                  : 'bg-[#24A0ED]/10 hover:bg-[#24A0ED]/20 text-[#24A0ED]',
              )}
            >
              <PlayIcon size={11} className={cn(isRunning && 'animate-pulse')} />
              {isRunning ? 'Running…' : 'Run'}
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copy code"
            className="p-1.5 rounded-lg text-black/50 dark:text-white/50 hover:bg-light-primary dark:hover:bg-dark-primary transition-colors duration-200"
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expand' : 'Collapse'}
            className="p-1.5 rounded-lg text-black/50 dark:text-white/50 hover:bg-light-primary dark:hover:bg-dark-primary transition-colors duration-200"
          >
            {collapsed ? (
              <ChevronDownIcon size={13} />
            ) : (
              <ChevronUpIcon size={13} />
            )}
          </button>
        </div>
      </div>

      {/* Code body */}
      {!collapsed && (
        <div className="text-sm">
          <CodeBlock language={cell.language}>{cell.code}</CodeBlock>
        </div>
      )}

      {/* Warning / run output */}
      {!collapsed && (
        <div className="px-3 pb-3">
          {pendingRun && (
            <RunWarningBanner
              onConfirm={handleConfirm}
              onCancel={() => setPendingRun(false)}
            />
          )}
          {runState && <CellRunOutput run={runState} />}
        </div>
      )}
    </div>
  );
};

const CodeCellPanel = ({ codeCells }: { codeCells: CodeCell[] }) => {
  const [executionAcknowledged, setExecutionAcknowledged] = useState(false);

  if (codeCells.length === 0) return null;

  return (
    <div className="flex flex-col space-y-3 w-full">
      <div className="flex items-center gap-2">
        <TerminalIcon size={18} className="text-black dark:text-white" />
        <h3 className="text-black dark:text-white font-medium text-base">
          Code Cells
        </h3>
        <span className="text-xs text-black/40 dark:text-white/40 bg-light-secondary dark:bg-dark-secondary px-2 py-0.5 rounded-full">
          {codeCells.length}
        </span>
      </div>
      <div className="flex flex-col space-y-3">
        {codeCells.map((cell, i) => (
          <SingleCodeCell
            key={cell.id}
            cell={cell}
            index={i}
            executionAcknowledged={executionAcknowledged}
            onAcknowledge={() => setExecutionAcknowledged(true)}
          />
        ))}
      </div>
    </div>
  );
};

export default CodeCellPanel;
