// ===========================================
// POST /api/queue/next — Advance Queue (Staff Only)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { staffActionSchema } from '@/lib/validation';
import { advanceQueue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = staffActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid session ID' },
        { status: 400 }
      );
    }

    const result = await advanceQueue(parsed.data.sessionId);

    return NextResponse.json({
      success: true,
      newToken: result.newToken,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('Queue advance error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to advance queue' },
      { status: 500 }
    );
  }
}
