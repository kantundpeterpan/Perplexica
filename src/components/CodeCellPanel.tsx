'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  PlayIcon,
  CheckIcon,
  CopyIcon,
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
  executionAcknowledged,
  onAcknowledge,
}: {
  cell: CodeCell;
  executionAcknowledged: boolean;
  onAcknowledge: () => void;
}) => {
  const [runState, setRunState] = useState<RunState>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);
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
    <div className="flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-light-200 dark:border-dark-200">
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
            className="p-1.5 rounded-lg text-black/50 dark:text-white/50 hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors duration-200"
          >
            {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          </button>
        </div>
      </div>

      {/* Code body */}
      <div className="text-sm overflow-auto max-h-[60vh]">
        <CodeBlock language={cell.language}>{cell.code}</CodeBlock>
      </div>

      {/* Warning / run output */}
      <div className="px-3 pb-3">
        {pendingRun && (
          <RunWarningBanner
            onConfirm={handleConfirm}
            onCancel={() => setPendingRun(false)}
          />
        )}
        {runState && <CellRunOutput run={runState} />}
      </div>
    </div>
  );
};

const CodeCellPanel = ({
  codeCells,
  activeCellIndex,
  onCellActivate,
}: {
  codeCells: CodeCell[];
  activeCellIndex?: number;
  onCellActivate?: (index: number) => void;
}) => {
  const [executionAcknowledged, setExecutionAcknowledged] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Sync external activation (e.g. clicking a truncated inline block)
  useEffect(() => {
    if (activeCellIndex !== undefined && activeCellIndex < codeCells.length) {
      setActiveTab(activeCellIndex);
    }
  }, [activeCellIndex, codeCells.length]);

  // When a new cell is streamed in, auto-select the latest tab
  // Initialized with current length so the effect only fires for *new* cells
  // streamed in after this component mounts (not on initial load from history).
  const prevLengthRef = React.useRef(codeCells.length);
  useEffect(() => {
    if (codeCells.length > prevLengthRef.current) {
      setActiveTab(codeCells.length - 1);
    }
    prevLengthRef.current = codeCells.length;
  }, [codeCells.length]);

  if (codeCells.length === 0) return null;

  const activeCell = codeCells[activeTab] ?? codeCells[0];

  const handleTabClick = (i: number) => {
    setActiveTab(i);
    onCellActivate?.(i);
  };

  return (
    <div className="flex flex-col w-full rounded-xl border border-light-200 dark:border-dark-200 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-light-secondary dark:bg-dark-secondary border-b border-light-200 dark:border-dark-200 flex-shrink-0">
        <TerminalIcon size={14} className="text-black/60 dark:text-white/60" />
        <span className="text-xs font-medium text-black/60 dark:text-white/60">
          Code Cells
        </span>
        <span className="text-xs text-black/30 dark:text-white/30 bg-light-primary dark:bg-dark-primary px-1.5 py-0.5 rounded-full">
          {codeCells.length}
        </span>
      </div>

      {/* Tab bar */}
      {codeCells.length > 1 && (
        <div className="flex overflow-x-auto border-b border-light-200 dark:border-dark-200 bg-light-secondary dark:bg-dark-secondary">
          {codeCells.map((cell, i) => (
            <button
              key={cell.id}
              onClick={() => handleTabClick(i)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors duration-150 flex-shrink-0',
                activeTab === i
                  ? 'border-[#24A0ED] text-[#24A0ED] bg-light-primary dark:bg-dark-primary'
                  : 'border-transparent text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70 hover:bg-light-primary/50 dark:hover:bg-dark-primary/50',
              )}
            >
              <span className="font-mono">{cell.language || 'text'}</span>
              <span className="opacity-60">#{i + 1}</span>
            </button>
          ))}
        </div>
      )}

      {/* Active cell content */}
      <SingleCodeCell
        key={activeCell.id}
        cell={activeCell}
        executionAcknowledged={executionAcknowledged}
        onAcknowledge={() => setExecutionAcknowledged(true)}
      />
    </div>
  );
};

export default CodeCellPanel;
