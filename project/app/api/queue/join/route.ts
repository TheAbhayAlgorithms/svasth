// ===========================================
// POST /api/queue/join — Patient Check-in
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { checkInSchema } from '@/lib/validation';
import { joinQueue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parsed = checkInSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 }
      );
    }

    const { doctorId, name, phone, consent } = parsed.data;

    // Join queue
    const result = await joinQueue({ doctorId, name, phone, consent });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const trackingUrl = `${appUrl}/track?id=${result.entry.tracking_token}`;

    return NextResponse.json({
      success: true,
      tokenNumber: result.entry.token_number,
      currentToken: result.session.current_token,
      doctorName: result.doctor.name,
      trackingToken: result.entry.tracking_token,
      trackingUrl,
      patientName: result.patient.name,
    });
  } catch (error) {
    console.error('Queue join error:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Failed to join queue',
      },
      { status: 500 }
    );
  }
}
