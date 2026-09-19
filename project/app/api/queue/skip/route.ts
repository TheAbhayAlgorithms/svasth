// ===========================================
// POST /api/queue/skip — Skip Patient (Staff Only)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { staffActionSchema } from '@/lib/validation';
import { skipPatient } from '@/lib/queue';

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

    const result = await skipPatient(parsed.data.sessionId);

    return NextResponse.json({
      success: true,
      newToken: result.newToken,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('Queue skip error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to skip patient' },
      { status: 500 }
    );
  }
}
