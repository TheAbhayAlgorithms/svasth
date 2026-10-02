// ===========================================
// Notification Service
// Mock implementation for prototype, structured for real provider swap
// ===========================================

import { createServiceClient } from './supabase-server';
import type { NotificationChannel, NotificationType } from '@/types/database';

interface NotificationPayload {
  queueEntryId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  channel: NotificationChannel;
  notificationType: NotificationType;
  messageContent: string;
}

interface NotificationResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

// ===========================================
// Message Templates
// ===========================================

export function buildRegistrationMessage(params: {
  patientName: string;
  doctorName: string;
  tokenNumber: number;
  currentToken: number;
  trackingUrl: string;
}): string {
  return [
    `Hello ${params.patientName}, you are registered for ${params.doctorName}.`,
    `Your token is #${params.tokenNumber}.`,
    `Current token: #${params.currentToken}.`,
    `Track live queue: ${params.trackingUrl}`,
  ].join('\n');
}

export function buildApproachingMessage(params: {
  patientName: string;
  tokenNumber: number;
  currentToken: number;
  doctorName: string;
  roomNumber: string;
  trackingUrl: string;
}): string {
  return [
    `Hello ${params.patientName}, your token #${params.tokenNumber} is approaching.`,
    `Current token: #${params.currentToken}.`,
    `Please reach ${params.doctorName}'s Room ${params.roomNumber} soon.`,
    `Track: ${params.trackingUrl}`,
  ].join('\n');
}

export function buildCalledMessage(params: {
  patientName: string;
  tokenNumber: number;
  doctorName: string;
  roomNumber: string;
}): string {
  return [
    `${params.patientName}, your token #${params.tokenNumber} is now being called.`,
    `Please proceed to ${params.doctorName}'s Room ${params.roomNumber}.`,
  ].join('\n');
}

export function buildOtpMessage(params: { otp: string; doctorName?: string }): string {
  const docPart = params.doctorName ? ` for Dr. ${params.doctorName.replace(/^Dr\.\s*/i, '')}` : '';
  return `Your SVASTH verification code is ${params.otp}${docPart}. Valid for 5 minutes. Do not share this OTP with anyone.`;
}

// ===========================================
// Mock Provider
// ===========================================

async function sendMockNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100));

  console.log(`[MOCK ${payload.channel.toUpperCase()}] To: ${payload.patientPhone}`);
  console.log(`[MOCK] Type: ${payload.notificationType}`);
  console.log(`[MOCK] Message: ${payload.messageContent}`);
  console.log('---');

  return {
    success: true,
    providerMessageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  };
}

// ===========================================
// Real Provider Stubs (swap in when ready)
// ===========================================

async function sendTwilioSMS(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return { success: false, error: 'Twilio credentials not configured' };
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization:
            'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
        body: new URLSearchParams({
          To: payload.patientPhone,
          From: fromNumber,
          Body: payload.messageContent,
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return { success: true, providerMessageId: data.sid };
    }
    return { success: false, error: data.message || 'Twilio API error' };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function sendWhatsAppMessage(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: payload.patientPhone.replace('+', ''),
          type: 'text',
          text: { body: payload.messageContent },
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        providerMessageId: data.messages?.[0]?.id || 'unknown',
      };
    }
    return {
      success: false,
      error: data.error?.message || 'WhatsApp API error',
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// ===========================================
// Main Send Function
// ===========================================

export async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const mode = process.env.NOTIFICATION_MODE || 'mock';
  let result: NotificationResult;

  if (mode === 'mock') {
    result = await sendMockNotification(payload);
  } else if (payload.channel === 'sms') {
    result = await sendTwilioSMS(payload);
  } else {
    result = await sendWhatsAppMessage(payload);
  }

  // Log notification to database
  try {
    const supabase = createServiceClient();
    await supabase.from('notification_logs').insert({
      queue_entry_id: payload.queueEntryId,
      patient_id: payload.patientId,
      channel: payload.channel,
      notification_type: payload.notificationType,
      message_content: payload.messageContent,
      provider_message_id: result.providerMessageId || null,
      status: result.success ? (mode === 'mock' ? 'mocked' : 'sent') : 'failed',
      error_message: result.error || null,
    });
  } catch (logError) {
    console.error('Failed to log notification:', logError);
  }

  return result;
}

// ===========================================
// High-Level Notification Triggers
// ===========================================

export async function triggerRegistrationNotification(params: {
  queueEntryId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  tokenNumber: number;
  currentToken: number;
  trackingToken: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const trackingUrl = `${appUrl}/track?id=${params.trackingToken}`;

  const message = buildRegistrationMessage({
    patientName: params.patientName,
    doctorName: params.doctorName,
    tokenNumber: params.tokenNumber,
    currentToken: params.currentToken,
    trackingUrl,
  });

  // Send via WhatsApp (primary) and SMS (fallback)
  await sendNotification({
    queueEntryId: params.queueEntryId,
    patientId: params.patientId,
    patientName: params.patientName,
    patientPhone: params.patientPhone,
    channel: 'whatsapp',
    notificationType: 'registration',
    messageContent: message,
  });
}

export async function triggerApproachingNotification(params: {
  queueEntryId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  tokenNumber: number;
  currentToken: number;
  doctorName: string;
  roomNumber: string;
  trackingToken: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const trackingUrl = `${appUrl}/track?id=${params.trackingToken}`;

  const message = buildApproachingMessage({
    patientName: params.patientName,
    tokenNumber: params.tokenNumber,
    currentToken: params.currentToken,
    doctorName: params.doctorName,
    roomNumber: params.roomNumber,
    trackingUrl,
  });

  await sendNotification({
    queueEntryId: params.queueEntryId,
    patientId: params.patientId,
    patientName: params.patientName,
    patientPhone: params.patientPhone,
    channel: 'whatsapp',
    notificationType: 'approaching',
    messageContent: message,
  });

  // Mark as notified
  const supabase = createServiceClient();
  await supabase
    .from('queue_entries')
    .update({ notified_approaching: true })
    .eq('id', params.queueEntryId);
}

export async function triggerCalledNotification(params: {
  queueEntryId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  tokenNumber: number;
  doctorName: string;
  roomNumber: string;
}) {
  const message = buildCalledMessage({
    patientName: params.patientName,
    tokenNumber: params.tokenNumber,
    doctorName: params.doctorName,
    roomNumber: params.roomNumber,
  });

  await sendNotification({
    queueEntryId: params.queueEntryId,
    patientId: params.patientId,
    patientName: params.patientName,
    patientPhone: params.patientPhone,
    channel: 'whatsapp',
    notificationType: 'called',
    messageContent: message,
  });

  // Mark as notified
  const supabase = createServiceClient();
  await supabase
    .from('queue_entries')
    .update({ notified_called: true })
    .eq('id', params.queueEntryId);
}

// ===========================================
// OTP Verification Notification Trigger
// ===========================================

export async function sendOtpNotification(params: {
  phone: string;
  otp: string;
  doctorName?: string;
}): Promise<{ success: boolean; mockOtp?: string; error?: string }> {
  const mode = process.env.NOTIFICATION_MODE || 'mock';
  const message = buildOtpMessage({
    otp: params.otp,
    doctorName: params.doctorName,
  });

  if (mode === 'mock') {
    // In mock mode, output prominently to server console
    console.log('\n===========================================');
    console.log(`🔒 [SVASTH OTP AUTHENTICATION]`);
    console.log(`📱 Destination Mobile: ${params.phone}`);
    console.log(`🔑 6-Digit OTP: ${params.otp}`);
    console.log(`⏱️ Validity: 5 minutes`);
    if (params.doctorName) console.log(`👨‍⚕️ Doctor: ${params.doctorName}`);
    console.log('===========================================\n');

    return {
      success: true,
      mockOtp: params.otp,
    };
  }

  // Live mode: Try WhatsApp first, then Twilio SMS
  try {
    const payload: NotificationPayload = {
      queueEntryId: '00000000-0000-0000-0000-000000000000',
      patientId: '00000000-0000-0000-0000-000000000000',
      patientName: 'Patient',
      patientPhone: params.phone,
      channel: 'whatsapp',
      notificationType: 'registration',
      messageContent: message,
    };

    let result = await sendWhatsAppMessage(payload);
    if (!result.success) {
      payload.channel = 'sms';
      result = await sendTwilioSMS(payload);
    }

    return {
      success: result.success,
      error: result.error,
    };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message,
    };
  }
}

