// ===========================================
// POST /api/queue/join — Patient Check-in
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { checkInSchema } from '@/lib/validation';
import { joinQueue } from '@/lib/queue';
import { verifyOtp } from '@/lib/otp';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input including 6-digit OTP
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

    const { doctorId, name, phone, consent, otp } = parsed.data;

    // Securely authenticate: Match OTP sent to this exact mobile number
    const otpVerification = verifyOtp(phone, otp);
    if (!otpVerification.valid) {
      return NextResponse.json(
        {
          success: false,
          error: otpVerification.reason || 'Invalid OTP code.',
          remainingAttempts: otpVerification.remainingAttempts,
        },
        { status: 400 }
      );
    }

    // Join queue only after successful mobile OTP authentication
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
