'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import MessageInput from './MessageInput';
import MessageBox from './MessageBox';
import MessageBoxLoading from './MessageBoxLoading';
import ChatBubbleBox from './ChatBubbleBox';
import ResearchSidePanel from './ResearchSidePanel';
import { useChat } from '@/lib/hooks/useChat';
import { cn } from '@/lib/utils';

const Chat = () => {
  const {
    sections,
    loading,
    messageAppeared,
    messages,
    chatMode,
    researchOnlyMessageIds,
  } = useChat();

  const [dividerWidth, setDividerWidth] = useState(0);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const messageEnd = useRef<HTMLDivElement | null>(null);
  const lastScrolledRef = useRef<number>(0);

  /** Message ID whose research report is currently open in the side panel */
  const [researchPanelMsgId, setResearchPanelMsgId] = useState<string | null>(
    null,
  );

  const researchPanelSection = researchPanelMsgId
    ? sections.find((s) => s.message.messageId === researchPanelMsgId) ?? null
    : null;

  // Auto-open side panel when a deep-research message completes
  useEffect(() => {
    if (chatMode !== 'chat') return;
    const lastResearch = researchOnlyMessageIds[researchOnlyMessageIds.length - 1];
    if (lastResearch) {
      setResearchPanelMsgId(lastResearch);
    }
  }, [researchOnlyMessageIds, chatMode]);

  useEffect(() => {
    const updateDividerWidth = () => {
      if (dividerRef.current) {
        setDividerWidth(dividerRef.current.offsetWidth);
      }
    };

    updateDividerWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateDividerWidth();
    });

    const currentRef = dividerRef.current;
    if (currentRef) {
      resizeObserver.observe(currentRef);
    }

    window.addEventListener('resize', updateDividerWidth);

    return () => {
      if (currentRef) {
        resizeObserver.unobserve(currentRef);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDividerWidth);
    };
  }, [sections.length]);

  useEffect(() => {
    const scroll = () => {
      messageEnd.current?.scrollIntoView({ behavior: 'auto' });
    };

    if (messages.length === 1) {
      document.title = `${messages[0].query.substring(0, 30)} - Perplexica`;
    }

    if (sections.length > lastScrolledRef.current) {
      scroll();
      lastScrolledRef.current = sections.length;
    }
  }, [messages]);

  /* ── Chat mode layout ─────────────────────────────────────────────────── */
  if (chatMode === 'chat') {
    return (
      <div className="flex h-full overflow-hidden">
        {/* Chat column */}
        <div
          className={cn(
            'flex flex-col pt-6 pb-44 lg:pb-28 transition-all duration-300',
            researchPanelSection
              ? 'w-full lg:w-1/2 sm:mx-4 md:mx-8'
              : 'w-full sm:mx-4 md:mx-8',
          )}
        >
          <div className="flex flex-col space-y-6 max-w-3xl mx-auto w-full">
            {sections.map((section, i) => {
              const isLast = i === sections.length - 1;
              const isResearchMsg = researchOnlyMessageIds.includes(
                section.message.messageId,
              );

              return (
                <ChatBubbleBox
                  key={section.message.messageId}
                  section={section}
                  isLast={isLast}
                  onViewResearch={
                    isResearchMsg
                      ? () =>
                          setResearchPanelMsgId(section.message.messageId)
                      : undefined
                  }
                />
              );
            })}

            {loading && !messageAppeared && <MessageBoxLoading />}
            <div ref={messageEnd} className="h-0" />
          </div>

          {/* Input bar */}
          <div
            ref={dividerRef}
            className="fixed z-40 bottom-0 left-0 right-0 flex justify-center"
          >
            <div
              className={cn(
                'w-full max-w-3xl px-4 pb-4 pt-2',
                researchPanelSection ? 'lg:max-w-[calc(50vw-2rem)]' : '',
              )}
            >
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 dark:hidden"
                style={{ background: 'linear-gradient(to top, #ffffff 0%, #ffffff 40%, rgba(255,255,255,0.8) 70%, transparent 100%)' }}
              />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 hidden dark:block"
                style={{ background: 'linear-gradient(to top, #0d1117 0%, #0d1117 40%, rgba(13,17,23,0.8) 70%, transparent 100%)' }}
              />
              <div className="relative">
                <MessageInput />
              </div>
            </div>
          </div>
        </div>

        {/* Research side panel */}
        {researchPanelSection && (
          <div className="hidden lg:flex lg:w-1/2 fixed right-0 top-0 h-full z-30 shadow-xl">
            <ResearchSidePanel
              section={researchPanelSection}
              onClose={() => setResearchPanelMsgId(null)}
            />
          </div>
        )}
      </div>
    );
  }

  /* ── Research mode layout (original) ─────────────────────────────────── */
  return (
    <div className="flex flex-col space-y-6 pt-8 pb-44 lg:pb-28 sm:mx-4 md:mx-8">
      {sections.map((section, i) => {
        const isLast = i === sections.length - 1;

        return (
          <Fragment key={section.message.messageId}>
            <MessageBox
              section={section}
              sectionIndex={i}
              dividerRef={isLast ? dividerRef : undefined}
              isLast={isLast}
            />
            {!isLast && (
              <div className="h-px w-full bg-light-secondary dark:bg-dark-secondary" />
            )}
          </Fragment>
        );
      })}
      {loading && !messageAppeared && <MessageBoxLoading />}
      <div ref={messageEnd} className="h-0" />
      {dividerWidth > 0 && (
        <div
          className="fixed z-40 bottom-24 lg:bottom-6"
          style={{ width: dividerWidth }}
        >
          <div
            className="pointer-events-none absolute -bottom-6 left-0 right-0 h-[calc(100%+24px+24px)] dark:hidden"
            style={{
              background:
                'linear-gradient(to top, #ffffff 0%, #ffffff 35%, rgba(255,255,255,0.95) 45%, rgba(255,255,255,0.85) 55%, rgba(255,255,255,0.7) 65%, rgba(255,255,255,0.5) 75%, rgba(255,255,255,0.3) 85%, rgba(255,255,255,0.1) 92%, transparent 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-6 left-0 right-0 h-[calc(100%+24px+24px)] hidden dark:block"
            style={{
              background:
                'linear-gradient(to top, #0d1117 0%, #0d1117 35%, rgba(13,17,23,0.95) 45%, rgba(13,17,23,0.85) 55%, rgba(13,17,23,0.7) 65%, rgba(13,17,23,0.5) 75%, rgba(13,17,23,0.3) 85%, rgba(13,17,23,0.1) 92%, transparent 100%)',
            }}
          />
          <MessageInput />
        </div>
      )}
    </div>
  );
};

export default Chat;
