import { EventEmitter } from 'stream';
import { applyPatch } from 'rfc6902';
import { Block } from './types';

const sessions =
  (global as any)._sessionManagerSessions || new Map<string, SessionManager>();
if (process.env.NODE_ENV !== 'production') {
  (global as any)._sessionManagerSessions = sessions;
}

class SessionManager {
  private static sessions: Map<string, SessionManager> = sessions;
  readonly id: string;
  private blocks = new Map<string, Block>();
  private events: { event: string; data: any }[] = [];
  private emitter = new EventEmitter();
  private TTL_MS = 30 * 60 * 1000;
  private approvalResolvers = new Map<
    string,
    (result: { approved: boolean; steering?: string }) => void
  >();
  private approvalTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(id?: string) {
    this.id = id ?? crypto.randomUUID();

    setTimeout(() => {
      SessionManager.sessions.delete(this.id);
    }, this.TTL_MS);
  }

  static getSession(id: string): SessionManager | undefined {
    return this.sessions.get(id);
  }

  static getAllSessions(): SessionManager[] {
    return Array.from(this.sessions.values());
  }

  static createSession(): SessionManager {
    const session = new SessionManager();
    this.sessions.set(session.id, session);
    return session;
  }

  removeAllListeners() {
    this.emitter.removeAllListeners();
  }

  emit(event: string, data: any) {
    this.emitter.emit(event, data);
    this.events.push({ event, data });
  }

  emitBlock(block: Block) {
    this.blocks.set(block.id, block);
    this.emit('data', {
      type: 'block',
      block: block,
    });
  }

  getBlock(blockId: string): Block | undefined {
    return this.blocks.get(blockId);
  }

  updateBlock(blockId: string, patch: any[]) {
    const block = this.blocks.get(blockId);

    if (block) {
      applyPatch(block, patch);
      this.blocks.set(blockId, block);
      this.emit('data', {
        type: 'updateBlock',
        blockId: blockId,
        patch: patch,
      });
    }
  }

  getAllBlocks() {
    return Array.from(this.blocks.values());
  }

  /**
   * Pause execution until the user approves or denies an MCP tool call.
   * Resolves with `{ approved, steering? }` when the user responds via
   * POST /api/mcp/approval/[blockId].  Times out after `timeoutMs` with
   * `{ approved: false }` to prevent indefinite hangs.
   */
  waitForApproval(
    blockId: string,
    timeoutMs = 10 * 60 * 1000,
  ): Promise<{ approved: boolean; steering?: string }> {
    return new Promise((resolve) => {
      this.approvalResolvers.set(blockId, resolve);
      const timer = setTimeout(() => {
        if (this.approvalResolvers.has(blockId)) {
          this.approvalResolvers.delete(blockId);
          this.approvalTimers.delete(blockId);
          this.updateBlock(blockId, [
            { op: 'replace', path: '/data/status', value: 'denied' },
          ]);
          resolve({ approved: false });
        }
      }, timeoutMs);
      this.approvalTimers.set(blockId, timer);
    });
  }

  resolveApproval(
    blockId: string,
    result: { approved: boolean; steering?: string },
  ) {
    const resolver = this.approvalResolvers.get(blockId);
    if (resolver) {
      this.approvalResolvers.delete(blockId);
      const timer = this.approvalTimers.get(blockId);
      if (timer !== undefined) {
        clearTimeout(timer);
        this.approvalTimers.delete(blockId);
      }
      const patches: any[] = [
        {
          op: 'replace',
          path: '/data/status',
          value: result.approved ? 'approved' : 'denied',
        },
      ];
      if (result.steering) {
        patches.push({ op: 'add', path: '/data/steering', value: result.steering });
      }
      this.updateBlock(blockId, patches);
      resolver(result);
    }
  }

  subscribe(listener: (event: string, data: any) => void): () => void {
    const currentEventsLength = this.events.length;

    const handler = (event: string) => (data: any) => listener(event, data);
    const dataHandler = handler('data');
    const endHandler = handler('end');
    const errorHandler = handler('error');

    this.emitter.on('data', dataHandler);
    this.emitter.on('end', endHandler);
    this.emitter.on('error', errorHandler);

    for (let i = 0; i < currentEventsLength; i++) {
      const { event, data } = this.events[i];
      listener(event, data);
    }

    return () => {
      this.emitter.off('data', dataHandler);
      this.emitter.off('end', endHandler);
      this.emitter.off('error', errorHandler);
    };
  }
}

export default SessionManager;
