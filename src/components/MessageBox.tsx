'use client';

/* eslint-disable @next/next/no-img-element */
import React, { MutableRefObject, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BookCopy,
  Disc3,
  Volume2,
  StopCircle,
  Layers3,
  Plus,
  CornerDownRight,
  ArrowRightIcon,
} from 'lucide-react';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import Copy from './MessageActions/Copy';
import Rewrite from './MessageActions/Rewrite';
import MessageSources from './MessageSources';
import SearchImages from './SearchImages';
import SearchVideos from './SearchVideos';
import { useSpeech } from 'react-text-to-speech';
import ThinkBox from './ThinkBox';
import { useChat, Section } from '@/lib/hooks/useChat';
import Citation from './MessageRenderer/Citation';
import AssistantSteps from './AssistantSteps';
import Renderer from './Widgets/Renderer';
import CodeBlock from './MessageRenderer/CodeBlock';
import MCPApprovalWidget from './MCPApprovalWidget';
import CodeCellPanel from './CodeCellPanel';
import { MCPApprovalBlock, ResearchBlock } from '@/lib/types';
import { getCodeCellTruncateLines, getCodePanelWidth } from '@/lib/config/clientRegistry';

const DEFAULT_TRUNCATE_LINES = 10;

/** Maps the codePanelWidth setting to Tailwind column classes. */
const PANEL_WIDTH_CLASSES: Record<string, { panel: string; conversation: string }> = {
  '4': { panel: 'lg:w-4/12', conversation: 'lg:w-8/12' },
  '5': { panel: 'lg:w-5/12', conversation: 'lg:w-7/12' },
  '6': { panel: 'lg:w-6/12', conversation: 'lg:w-6/12' },
  '7': { panel: 'lg:w-7/12', conversation: 'lg:w-5/12' },
};

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

const MessageBox = ({
  section,
  sectionIndex,
  dividerRef,
  isLast,
}: {
  section: Section;
  sectionIndex: number;
  dividerRef?: MutableRefObject<HTMLDivElement | null>;
  isLast: boolean;
}) => {
  const {
    loading,
    sendMessage,
    rewrite,
    messages,
    researchEnded,
    chatHistory,
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
  const hasCells = section.codeCells.length > 0;

  const { speechStatus, start, stop } = useSpeech({ text: speechMessage });

  const [activeCellRequest, setActiveCellRequest] = useState<
    { index: number; rev: number } | undefined
  >(undefined);

  const handleCellActivate = (index: number) =>
    setActiveCellRequest((prev) => ({ index, rev: (prev?.rev ?? 0) + 1 }));

  // Configurable truncation threshold (reads from localStorage, reacts to settings changes)
  const [truncateLines, setTruncateLines] = useState<number>(() =>
    typeof window !== 'undefined'
      ? getCodeCellTruncateLines()
      : DEFAULT_TRUNCATE_LINES,
  );

  const [codePanelWidth, setCodePanelWidth] = useState<string>(() =>
    typeof window !== 'undefined' ? getCodePanelWidth() : '6',
  );

  useEffect(() => {
    const update = () => {
      setTruncateLines(getCodeCellTruncateLines());
      setCodePanelWidth(getCodePanelWidth());
    };
    update();
    window.addEventListener('client-config-changed', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('client-config-changed', update);
      window.removeEventListener('storage', update);
    };
  }, []);

  // Counter that correlates inline code blocks with code panel cells.
  // `renderRule` is called synchronously by markdown-to-jsx during React's
  // render phase, so incrementing a plain `let` variable here is safe and
  // always maps to the correct cell index.
  let inlineCellIdx = 0;

  const markdownOverrides: MarkdownToJSX.Options = {
    renderRule(next, node, renderChildren, state) {
      if (node.type === RuleType.codeInline) {
        return `\`${node.text}\``;
      }

      if (node.type === RuleType.codeBlock) {
        const cellIndex = inlineCellIdx++;
        const code: string = node.text;
        const lines = code.split('\n');

        if (lines.length > truncateLines) {
          const preview = lines.slice(0, truncateLines).join('\n');
          return (
            <div key={state.key} className="relative my-2">
              <div className="relative overflow-hidden">
                <CodeBlock language={node.lang || ''}>{preview}</CodeBlock>
                {/* Fade-out gradient overlay */}
                <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white dark:from-[#0d1117] to-transparent pointer-events-none" />
              </div>
              <button
                onClick={() => handleCellActivate(cellIndex)}
                className="mt-1 flex items-center gap-1 text-xs text-[#24A0ED] hover:underline"
              >
                <span>
                  {lines.length} lines — view full code in panel
                </span>
                <ArrowRightIcon size={11} />
              </button>
            </div>
          );
        }

        return (
          <div key={state.key} className="my-2">
            <CodeBlock language={node.lang || ''}>{code}</CodeBlock>
            {hasCells && (
              <button
                onClick={() => handleCellActivate(cellIndex)}
                className="mt-1 flex items-center gap-1 text-xs text-[#24A0ED]/60 hover:text-[#24A0ED] hover:underline transition-colors"
              >
                <span>view in panel</span>
                <ArrowRightIcon size={11} />
              </button>
            )}
          </div>
        );
      }

      return next();
    },
    overrides: {
      think: {
        component: ThinkTagProcessor,
        props: {
          thinkingEnded: thinkingEnded,
        },
      },
      citation: {
        component: Citation,
      },
    },
  };

  const widthClasses = PANEL_WIDTH_CLASSES[codePanelWidth] ?? PANEL_WIDTH_CLASSES['6'];

  return (
    <div className="space-y-6">
      <div className={'w-full pt-8 break-words'}>
        <h2
          className={cn(
            'text-black dark:text-white font-medium text-3xl',
            hasCells ? 'lg:w-full' : 'lg:w-9/12',
          )}
        >
          {section.message.query}
        </h2>
      </div>

      <div className="flex flex-col space-y-9 lg:space-y-0 lg:flex-row lg:justify-between lg:space-x-9">
        <div
          ref={dividerRef}
          className={cn(
            'flex flex-col space-y-6 w-full',
            hasCells ? widthClasses.conversation : 'lg:w-9/12',
          )}
        >
          {sources.length > 0 && (
            <div className="flex flex-col space-y-2">
              <div className="flex flex-row items-center space-x-2">
                <BookCopy className="text-black dark:text-white" size={20} />
                <h3 className="text-black dark:text-white font-medium text-xl">
                  Sources
                </h3>
              </div>
              <MessageSources sources={sources} />
            </div>
          )}

          {section.message.responseBlocks
            .filter(
              (block): block is ResearchBlock =>
                block.type === 'research' && block.data.subSteps.length > 0,
            )
            .map((researchBlock) => (
              <div key={researchBlock.id} className="flex flex-col space-y-2">
                <AssistantSteps
                  block={researchBlock}
                  status={section.message.status}
                  isLast={isLast}
                />
              </div>
            ))}

          {section.message.responseBlocks
            .filter(
              (block): block is MCPApprovalBlock =>
                block.type === 'mcp_approval',
            )
            .map((approvalBlock) => (
              <MCPApprovalWidget key={approvalBlock.id} block={approvalBlock} />
            ))}

          {isLast &&
            loading &&
            !researchEnded &&
            chatMode !== 'chat' &&
            !section.message.responseBlocks.some(
              (b) => b.type === 'research' && b.data.subSteps.length > 0,
            ) && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-light-secondary dark:bg-dark-secondary border border-light-200 dark:border-dark-200">
                <Disc3 className="w-4 h-4 text-black dark:text-white animate-spin" />
                <span className="text-sm text-black/70 dark:text-white/70">
                  Brainstorming...
                </span>
              </div>
            )}

          {section.widgets.length > 0 && <Renderer widgets={section.widgets} />}

          <div className="flex flex-col space-y-2">
            {sources.length > 0 && chatMode !== 'chat' && (
              <div className="flex flex-row items-center space-x-2">
                <Disc3
                  className={cn(
                    'text-black dark:text-white',
                    isLast && loading ? 'animate-spin' : 'animate-none',
                  )}
                  size={20}
                />
                <h3 className="text-black dark:text-white font-medium text-xl">
                  Answer
                </h3>
              </div>
            )}

            {hasContent && (
              <>
                <Markdown
                  className={cn(
                    'prose prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                    'max-w-none break-words text-black dark:text-white',
                  )}
                  options={markdownOverrides}
                >
                  {parsedMessage}
                </Markdown>

                {loading && isLast ? null : (
                  <div className="flex flex-row items-center justify-between w-full text-black dark:text-white py-4">
                    <div className="flex flex-row items-center -ml-2">
                      <Rewrite
                        rewrite={rewrite}
                        messageId={section.message.messageId}
                      />
                    </div>
                    <div className="flex flex-row items-center -mr-2">
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
                          <StopCircle size={16} />
                        ) : (
                          <Volume2 size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {isLast &&
                  section.suggestions &&
                  section.suggestions.length > 0 &&
                  hasContent &&
                  !loading && (
                    <div className="mt-6">
                      <div className="flex flex-row items-center space-x-2 mb-4">
                        <Layers3
                          className="text-black dark:text-white"
                          size={20}
                        />
                        <h3 className="text-black dark:text-white font-medium text-xl">
                          Related
                        </h3>
                      </div>
                      <div className="space-y-0">
                        {section.suggestions.map(
                          (suggestion: string, i: number) => (
                            <div key={i}>
                              <div className="h-px bg-light-200/40 dark:bg-dark-200/40" />
                              <button
                                onClick={() => sendMessage(suggestion)}
                                className="group w-full py-4 text-left transition-colors duration-200"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex flex-row space-x-3 items-center">
                                    <CornerDownRight
                                      size={15}
                                      className="group-hover:text-sky-400 transition-colors duration-200 flex-shrink-0"
                                    />
                                    <p className="text-sm text-black/70 dark:text-white/70 group-hover:text-sky-400 transition-colors duration-200 leading-relaxed">
                                      {suggestion}
                                    </p>
                                  </div>
                                  <Plus
                                    size={16}
                                    className="text-black/40 dark:text-white/40 group-hover:text-sky-400 transition-colors duration-200 flex-shrink-0"
                                  />
                                </div>
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {(hasContent || hasCells) && (
          <div
            className={cn(
              'lg:sticky lg:top-20 flex flex-col items-center space-y-3 w-full z-30 h-full pb-4',
              hasCells ? widthClasses.panel : 'lg:w-3/12',
            )}
          >
            {hasCells && (
              <div className="w-full">
                <CodeCellPanel
                  codeCells={section.codeCells}
                  activeCellRequest={activeCellRequest}
                />
              </div>
            )}
            <SearchImages
              query={section.message.query}
              chatHistory={chatHistory}
              messageId={section.message.messageId}
            />
            <SearchVideos
              chatHistory={chatHistory}
              query={section.message.query}
              messageId={section.message.messageId}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBox;
