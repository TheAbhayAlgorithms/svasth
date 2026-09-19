// ===========================================
// GET /api/queue/dashboard?sessionId=... — Get Staff Dashboard Data
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getStaffDashboardData } from '@/lib/queue';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    const data = await getStaffDashboardData(sessionId);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    console.error('Dashboard data error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
