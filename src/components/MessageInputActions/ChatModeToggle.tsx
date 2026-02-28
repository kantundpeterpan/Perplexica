'use client';

import { MessageSquare, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChat } from '@/lib/hooks/useChat';

/**
 * Toggles the assistant between **Chat** (conversational) and **Research**
 * (deep web-search) modes.  The selected mode is scoped to the current
 * session only and takes effect on the next message.
 */
const ChatModeToggle = () => {
  const { chatMode, setChatMode } = useChat();

  return (
    <div
      className="flex flex-row items-center rounded-full border border-light-200 dark:border-dark-200 bg-light-primary dark:bg-dark-primary overflow-hidden text-xs flex-shrink-0 whitespace-nowrap"
      title="Toggle between Chat and Research mode"
    >
      <button
        type="button"
        onClick={() => setChatMode('chat')}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 transition-colors duration-150',
          chatMode === 'chat'
            ? 'bg-sky-500 text-white'
            : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white',
        )}
        title="Chat mode – conversational, no web search"
      >
        <MessageSquare size={13} />
        <span>Chat</span>
      </button>
      <button
        type="button"
        onClick={() => setChatMode('research')}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 transition-colors duration-150',
          chatMode === 'research'
            ? 'bg-sky-500 text-white'
            : 'text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white',
        )}
        title="Research mode – deep search with web sources"
      >
        <Search size={13} />
        <span>Research</span>
      </button>
    </div>
  );
};

export default ChatModeToggle;
