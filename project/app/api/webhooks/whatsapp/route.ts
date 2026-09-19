// ===========================================
// POST /api/webhooks/whatsapp — WhatsApp Delivery Status
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // WhatsApp Cloud API webhook format
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const statuses = change.value?.statuses || [];
        for (const status of statuses) {
          const messageId = status.id;
          const deliveryStatus = status.status; // sent, delivered, read, failed

          if (messageId) {
            const supabase = createServiceClient();
            await supabase
              .from('notification_logs')
              .update({
                status: deliveryStatus === 'failed' ? 'failed' : 'delivered',
              })
              .eq('provider_message_id', messageId);
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ success: true }); // Always return 200 for webhooks
  }
}

// GET for webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}
