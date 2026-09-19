// ===========================================
// POST /api/queue/resume — Resume Queue (Staff Only)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { staffActionSchema } from '@/lib/validation';
import { resumeQueue } from '@/lib/queue';

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

    const result = await resumeQueue(parsed.data.sessionId);

    return NextResponse.json({ success: true, status: result.status });
  } catch (error) {
    console.error('Queue resume error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to resume queue' },
      { status: 500 }
    );
  }
}
