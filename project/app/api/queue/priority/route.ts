// ===========================================
// POST /api/queue/priority — Add Priority Patient (Staff Only)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { priorityPatientSchema } from '@/lib/validation';
import { addPriorityPatient } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = priorityPatientSchema.safeParse(body);
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

    const result = await addPriorityPatient(parsed.data);

    return NextResponse.json({
      success: true,
      tokenNumber: result.tokenNumber,
      trackingToken: result.trackingToken,
      patientName: result.patient.name,
    });
  } catch (error) {
    console.error('Priority patient error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'Failed to add priority patient' },
      { status: 500 }
    );
  }
}
