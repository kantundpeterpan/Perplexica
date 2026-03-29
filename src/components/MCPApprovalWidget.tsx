'use client';

import { useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MCPApprovalBlock } from '@/lib/types';

const MCPApprovalWidget = ({ block }: { block: MCPApprovalBlock }) => {
  const [showSteering, setShowSteering] = useState(false);
  const [steering, setSteering] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showArgs, setShowArgs] = useState(false);

  const { toolName, serverName, args, reasoning, status, sessionId } =
    block.data;

  const respond = async (approved: boolean, steeringText?: string) => {
    setSubmitting(true);
    try {
      await fetch(`/api/mcp/approval/${block.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          approved,
          steering: steeringText || undefined,
        }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'approved') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
        <span className="text-sm text-green-700 dark:text-green-300">
          <strong>{toolName}</strong>{' '}
          <span className="font-normal">from</span>{' '}
          <strong>{serverName}</strong> — approved and executed
        </span>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-sm text-red-700 dark:text-red-300">
            <strong>{toolName}</strong>{' '}
            <span className="font-normal">from</span>{' '}
            <strong>{serverName}</strong> — denied
          </span>
          {block.data.steering && (
            <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-0.5">
              User guidance: {block.data.steering}
            </p>
          )}
        </div>
      </div>
    );
  }

  /* Pending — interactive approval UI */
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Tool approval required
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            The assistant wants to use{' '}
            <strong className="font-semibold">{toolName}</strong> from{' '}
            <strong className="font-semibold">{serverName}</strong>
          </p>
        </div>
      </div>

      {/* Reasoning */}
      {reasoning && (
        <div className="px-3 pb-2 border-t border-amber-200 dark:border-amber-800">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mt-2 mb-0.5">
            Assistant reasoning
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-400/80 leading-relaxed">
            {reasoning}
          </p>
        </div>
      )}

      {/* Collapsible parameters */}
      {Object.keys(args).length > 0 && (
        <div className="px-3 pb-2 border-t border-amber-200 dark:border-amber-800">
          <button
            onClick={() => setShowArgs(!showArgs)}
            className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300 mt-2"
          >
            {showArgs ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            Tool parameters
          </button>
          {showArgs && (
            <pre className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1 overflow-x-auto bg-amber-100 dark:bg-amber-900/40 rounded p-2 whitespace-pre-wrap break-all">
              {JSON.stringify(args, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="px-3 pb-3 pt-2 border-t border-amber-200 dark:border-amber-800 flex flex-col gap-2">
        {!showSteering ? (
          <div className="flex gap-2">
            <button
              onClick={() => respond(true)}
              disabled={submitting}
              className="flex-1 py-1.5 px-3 rounded-md text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
            >
              Allow
            </button>
            <button
              onClick={() => setShowSteering(true)}
              disabled={submitting}
              className="flex-1 py-1.5 px-3 rounded-md text-sm font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
            >
              Deny
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Optionally tell the assistant what to do instead:
            </p>
            <textarea
              value={steering}
              onChange={(e) => setSteering(e.target.value)}
              placeholder="Use a different approach… or leave blank to just abort"
              rows={2}
              className="text-xs rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-dark-secondary text-black dark:text-white p-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <div className="flex gap-2">
              <button
                onClick={() => respond(false, steering.trim() || undefined)}
                disabled={submitting}
                className="flex-1 py-1.5 px-3 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
              >
                Confirm Deny
              </button>
              <button
                onClick={() => setShowSteering(false)}
                disabled={submitting}
                className="flex-1 py-1.5 px-3 rounded-md text-sm font-medium bg-light-200 dark:bg-dark-200 text-black dark:text-white hover:bg-light-300 dark:hover:bg-dark-300 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MCPApprovalWidget;
