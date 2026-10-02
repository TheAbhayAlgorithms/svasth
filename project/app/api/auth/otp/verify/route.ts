// ===========================================
// POST /api/auth/otp/verify — Verify 6-digit OTP
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { phoneSchema, otpSchema } from '@/lib/validation';
import { verifyOtp } from '@/lib/otp';

const verifySchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 }
      );
    }

    const { phone, otp } = parsed.data;
    const result = verifyOtp(phone, otp);

    if (!result.valid) {
      return NextResponse.json(
        {
          success: false,
          error: result.reason || 'Invalid OTP code',
          remainingAttempts: result.remainingAttempts,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Mobile number verified successfully.',
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Failed to verify OTP',
      },
      { status: 500 }
    );
  }
}
