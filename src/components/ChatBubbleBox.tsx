'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject } from 'react';
import { cn } from '@/lib/utils';
import {
  Disc3,
  Volume2,
  StopCircle,
  CornerDownRight,
  Plus,
  BookCopy,
  FlaskConical,
} from 'lucide-react';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import { useSpeech } from 'react-text-to-speech';
import ThinkBox from './ThinkBox';
import { useChat, Section } from '@/lib/hooks/useChat';
import Citation from './MessageRenderer/Citation';
import AssistantSteps from './AssistantSteps';
import CodeBlock from './MessageRenderer/CodeBlock';
import MCPApprovalWidget from './MCPApprovalWidget';
import { MCPApprovalBlock, ResearchBlock } from '@/lib/types';

const ThinkTagProcessor = ({
  children,
  thinkingEnded,
}: {
  children: React.ReactNode;
  thinkingEnded: boolean;
}) => {
  return (
    <ThinkBox content={children as string} thinkingEnded={thinkingEnded} />
  );
};

/**
 * Chat-mode message renderer.
 *
 * User messages are shown as right-aligned speech bubbles.
 * Assistant responses are shown as left-aligned bubbles with inline tool
 * steps (collapsible) and compact source footnotes.
 */
const ChatBubbleBox = ({
  section,
  isLast,
  onViewResearch,
}: {
  section: Section;
  isLast: boolean;
  /** When set, renders a "View Research Report" button that calls this. */
  onViewResearch?: () => void;
}) => {
  const {
    loading,
    sendMessage,
    rewrite,
    researchEnded,
    chatMode,
  } = useChat();

  const parsedMessage = section.parsedTextBlocks.join('\n\n');
  const speechMessage = section.speechMessage || '';
  const thinkingEnded = section.thinkingEnded;

  const sourceBlocks = section.message.responseBlocks.filter(
    (block): block is typeof block & { type: 'source' } =>
      block.type === 'source',
  );
  const sources = sourceBlocks.flatMap((block) => block.data);

  const hasContent = section.parsedTextBlocks.length > 0;

  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });

  const markdownOverrides: MarkdownToJSX.Options = {
    renderRule(next, node, renderChildren, state) {
      if (node.type === RuleType.codeInline) {
        return `\`${node.text}\``;
      }
      if (node.type === RuleType.codeBlock) {
        return (
          <CodeBlock key={state.key} language={node.lang || ''}>
            {node.text}
          </CodeBlock>
        );
      }
      return next();
    },
    overrides: {
      think: {
        component: ThinkTagProcessor,
        props: { thinkingEnded },
      },
      citation: { component: Citation },
    },
  };

  return (
    <div className="flex flex-col space-y-3 w-full">
      {/* ── User message bubble ── */}
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-sky-500 text-white text-sm leading-relaxed shadow-sm">
          {section.message.query}
        </div>
      </div>

      {/* ── Research / tool steps (collapsible) ── */}
      {section.message.responseBlocks
        .filter(
          (block): block is ResearchBlock =>
            block.type === 'research' && block.data.subSteps.length > 0,
        )
        .map((researchBlock) => (
          <div key={researchBlock.id} className="pl-0">
            <AssistantSteps
              block={researchBlock}
              status={section.message.status}
              isLast={isLast}
            />
          </div>
        ))}

      {/* ── MCP approval widgets ── */}
      {section.message.responseBlocks
        .filter(
          (block): block is MCPApprovalBlock =>
            block.type === 'mcp_approval',
        )
        .map((approvalBlock) => (
          <MCPApprovalWidget key={approvalBlock.id} block={approvalBlock} />
        ))}

      {/* ── "Thinking…" spinner when no steps yet ── */}
      {isLast &&
        loading &&
        !researchEnded &&
        !section.message.responseBlocks.some(
          (b) => b.type === 'research' && b.data.subSteps.length > 0,
        ) && (
          <div className="flex items-center gap-2 py-1">
            <Disc3 className="w-4 h-4 text-sky-400 animate-spin" />
            <span className="text-xs text-black/50 dark:text-white/50">
              Thinking…
            </span>
          </div>
        )}

      {/* ── Research report card (for deep-research messages) ── */}
      {onViewResearch && (
        <div className="flex">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200 max-w-[85%]">
            <BookCopy size={14} className="text-sky-500 flex-shrink-0" />
            <span className="text-xs text-black/70 dark:text-white/70">
              Research report ready
            </span>
            <button
              type="button"
              onClick={onViewResearch}
              className="ml-1 text-xs text-sky-500 hover:text-sky-600 transition-colors whitespace-nowrap"
            >
              View Report →
            </button>
          </div>
        </div>
      )}

      {/* ── Assistant response bubble ── */}
      {hasContent && (
        <div className="flex items-start gap-2">
          {/* Avatar dot */}
          <div className="w-5 h-5 mt-1 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-sky-500" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Bubble */}
            <div
              className={cn(
                'px-4 py-3 rounded-2xl rounded-tl-sm',
                'bg-light-secondary dark:bg-dark-secondary',
                'border border-light-200 dark:border-dark-200',
              )}
            >
              <Markdown
                className={cn(
                  'prose prose-sm prose-h1:mb-2 prose-h2:mb-1.5 prose-h2:mt-4 prose-h2:font-[700] prose-h3:mt-3 prose-h3:mb-1 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                  'max-w-none break-words text-black dark:text-white text-sm',
                )}
                options={markdownOverrides}
              >
                {parsedMessage}
              </Markdown>
            </div>

            {/* Compact source footnotes */}
            {sources.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5 pl-1">
                {sources.slice(0, 5).map((s, i) => {
                  const url = s.metadata?.url || '';
                  const title = s.metadata?.title || url;
                  const domain = url
                    ? (() => {
                        try {
                          return new URL(url).hostname;
                        } catch {
                          return '';
                        }
                      })()
                    : '';
                  return (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-black/40 dark:text-white/40 hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
                    >
                      {domain && (
                        <img
                          src={`https://s2.googleusercontent.com/s2/favicons?domain=${domain}&sz=32`}
                          alt=""
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <span>
                        [{i + 1}]{' '}
                        {title.length > 35
                          ? title.substring(0, 35) + '…'
                          : title}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            {(!loading || !isLast) && (
              <div className="flex flex-row items-center gap-0 mt-0.5 pl-0 -ml-1.5">
                <Rewrite
                  rewrite={rewrite}
                  messageId={section.message.messageId}
                />
                <Copy initialMessage={parsedMessage} section={section} />
                <button
                  onClick={() => {
                    if (speechStatus === 'started') {
                      stop();
                    } else {
                      start();
                    }
                  }}
                  className="p-2 text-black/70 dark:text-white/70 rounded-full hover:bg-light-secondary dark:hover:bg-dark-secondary transition duration-200 hover:text-black dark:hover:text-white"
                >
                  {speechStatus === 'started' ? (
                    <StopCircle size={14} />
                  ) : (
                    <Volume2 size={14} />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Suggestions ── */}
      {isLast &&
        section.suggestions &&
        section.suggestions.length > 0 &&
        hasContent &&
        !loading && (
          <div className="pl-7 space-y-0 mt-2">
            {section.suggestions.map((suggestion: string, i: number) => (
              <div key={i}>
                <div className="h-px bg-light-200/40 dark:bg-dark-200/40" />
                <button
                  onClick={() => sendMessage(suggestion)}
                  className="group w-full py-3 text-left transition-colors duration-200"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-row space-x-2 items-center">
                      <CornerDownRight
                        size={13}
                        className="group-hover:text-sky-400 transition-colors duration-200 flex-shrink-0"
                      />
                      <p className="text-xs text-black/70 dark:text-white/70 group-hover:text-sky-400 transition-colors duration-200 leading-relaxed">
                        {suggestion}
                      </p>
                    </div>
                    <Plus
                      size={13}
                      className="text-black/40 dark:text-white/40 group-hover:text-sky-400 transition-colors duration-200 flex-shrink-0"
                    />
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

export default ChatBubbleBox;
