// ===========================================
// POST /api/webhooks/sms — SMS Delivery Status (Twilio)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const messageSid = formData.get('MessageSid') as string;
    const messageStatus = formData.get('MessageStatus') as string;

    if (messageSid && messageStatus) {
      const supabase = createServiceClient();

      let status = 'sent';
      if (['delivered', 'read'].includes(messageStatus)) {
        status = 'delivered';
      } else if (['failed', 'undelivered'].includes(messageStatus)) {
        status = 'failed';
      }

      await supabase
        .from('notification_logs')
        .update({ status })
        .eq('provider_message_id', messageSid);
    }

    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('SMS webhook error:', error);
    return new NextResponse('<Response></Response>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
