// ===========================================
// GET /api/queue/status — Patient Queue Status
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStatus } from '@/lib/queue';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trackingToken = searchParams.get('id');

    if (!trackingToken || trackingToken.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing tracking token' },
        { status: 400 }
      );
    }

    const status = await getQueueStatus(trackingToken);

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Queue entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ...status });
  } catch (error) {
    console.error('Queue status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get queue status' },
      { status: 500 }
    );
  }
}
