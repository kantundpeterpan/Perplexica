'use client';

import { X, BookCopy } from 'lucide-react';
import Markdown, { MarkdownToJSX, RuleType } from 'markdown-to-jsx';
import { cn } from '@/lib/utils';
import { Section } from '@/lib/hooks/useChat';
import AssistantSteps from './AssistantSteps';
import MessageSources from './MessageSources';
import CodeBlock from './MessageRenderer/CodeBlock';
import Citation from './MessageRenderer/Citation';
import { ResearchBlock } from '@/lib/types';

/**
 * Side panel that shows a full research report alongside the chat view.
 * Rendered when the user triggers a Deep Research run from chat mode.
 */
const ResearchSidePanel = ({
  section,
  onClose,
}: {
  section: Section;
  onClose: () => void;
}) => {
  const parsedMessage = section.parsedTextBlocks.join('\n\n');

  const sourceBlocks = section.message.responseBlocks.filter(
    (block): block is typeof block & { type: 'source' } =>
      block.type === 'source',
  );
  const sources = sourceBlocks.flatMap((block) => block.data);

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
      citation: { component: Citation },
    },
  };

  return (
    <div className="flex flex-col h-full bg-light-primary dark:bg-dark-primary border-l border-light-200 dark:border-dark-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-light-200 dark:border-dark-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookCopy size={16} className="text-sky-500" />
          <span className="text-sm font-semibold text-black dark:text-white">
            Research Report
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white hover:bg-light-secondary dark:hover:bg-dark-secondary transition-colors"
          title="Close panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Query */}
        <h2 className="text-lg font-semibold text-black dark:text-white leading-snug">
          {section.message.query}
        </h2>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="flex flex-col space-y-2">
            <div className="flex flex-row items-center space-x-2">
              <BookCopy className="text-black dark:text-white" size={16} />
              <h3 className="text-black dark:text-white font-medium text-base">
                Sources
              </h3>
            </div>
            <MessageSources sources={sources} />
          </div>
        )}

        {/* Research steps */}
        {section.message.responseBlocks
          .filter(
            (block): block is ResearchBlock =>
              block.type === 'research' && block.data.subSteps.length > 0,
          )
          .map((researchBlock) => (
            <AssistantSteps
              key={researchBlock.id}
              block={researchBlock}
              status={section.message.status}
              isLast={false}
            />
          ))}

        {/* Report text */}
        {parsedMessage && (
          <div>
            <Markdown
              className={cn(
                'prose prose-sm prose-h1:mb-3 prose-h2:mb-2 prose-h2:mt-6 prose-h2:font-[800] prose-h3:mt-4 prose-h3:mb-1.5 prose-h3:font-[600] dark:prose-invert prose-p:leading-relaxed prose-pre:p-0 font-[400]',
                'max-w-none break-words text-black dark:text-white text-sm',
              )}
              options={markdownOverrides}
            >
              {parsedMessage}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResearchSidePanel;
