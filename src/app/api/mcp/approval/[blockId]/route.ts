import { NextRequest, NextResponse } from 'next/server';
import SessionManager from '@/lib/session';

/**
 * POST /api/mcp/approval/[blockId]
 *
 * Resolves a pending MCP tool approval block.
 * Body: { sessionId: string; approved: boolean; steering?: string }
 */
export const POST = async (
  req: NextRequest,
  { params }: { params: Promise<{ blockId: string }> },
) => {
  try {
    const { blockId } = await params;
    const body = await req.json();
    const { sessionId, approved, steering } = body as {
      sessionId: string;
      approved: boolean;
      steering?: string;
    };

    if (!sessionId) {
      return NextResponse.json(
        { message: 'sessionId is required.' },
        { status: 400 },
      );
    }

    const session = SessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { message: 'Session not found or expired.' },
        { status: 404 },
      );
    }

    session.resolveApproval(blockId, {
      approved: Boolean(approved),
      steering: steering || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('MCP approval error:', err);
    return NextResponse.json(
      { message: err?.message ?? 'Approval failed.' },
      { status: 500 },
    );
  }
};
