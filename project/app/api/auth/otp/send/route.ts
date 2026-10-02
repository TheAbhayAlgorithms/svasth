// ===========================================
// POST /api/auth/otp/send — Dispatch 6-digit OTP
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { sendOtpSchema } from '@/lib/validation';
import { sendOtp } from '@/lib/otp';
import { createServiceClient } from '@/lib/supabase-server';
import { mockStore } from '@/lib/mock-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues.map((i) => i.message).join(', '),
        },
        { status: 400 }
      );
    }

    const { phone, doctorId } = parsed.data;

    let doctorName: string | undefined;
    if (doctorId) {
      try {
        const supabase = createServiceClient();
        const { data: doc } = await supabase
          .from('doctors')
          .select('name')
          .eq('id', doctorId)
          .single();
        if (doc) doctorName = doc.name;
      } catch {
        const mockDoc = mockStore.getDoctor(doctorId);
        if (mockDoc) doctorName = mockDoc.name;
      }
    }

    const result = await sendOtp(phone, doctorName);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.message,
          cooldownSeconds: result.cooldownSeconds,
        },
        { status: 429 }
      );
    }

    const isMock = process.env.NOTIFICATION_MODE === 'mock' || !process.env.NOTIFICATION_MODE;

    return NextResponse.json({
      success: true,
      message: result.message,
      phone: result.normalizedPhone,
      // Provide demo OTP helper for effortless prototype evaluation
      ...(isMock && result.mockOtp ? { debugOtp: result.mockOtp } : {}),
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Failed to send OTP',
      },
      { status: 500 }
    );
  }
}
