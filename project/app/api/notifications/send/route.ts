// ===========================================
// POST /api/notifications/send — Internal Notification Dispatch
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { sendNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { queueEntryId, patientId, patientName, patientPhone, channel, notificationType, messageContent } = body;

    if (!queueEntryId || !patientId || !patientPhone || !channel || !notificationType || !messageContent) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await sendNotification({
      queueEntryId,
      patientId,
      patientName: patientName || 'Patient',
      patientPhone,
      channel,
      notificationType,
      messageContent,
    });

    return NextResponse.json({
      success: result.success,
      providerMessageId: result.providerMessageId,
      error: result.error,
    });
  } catch (error) {
    console.error('Notification send error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
