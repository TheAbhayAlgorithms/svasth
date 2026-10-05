// ===========================================
// OTP Service (One-Time Password Authentication)
// Secure 6-digit OTP generation, delivery, and verification
// ===========================================

import crypto from 'crypto';
import { normalizePhone } from './validation';
import { sendOtpNotification } from './notifications';

export interface OtpRecord {
  phone: string;
  otp: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown
const MAX_ATTEMPTS = 3;

// Global memory store persistent across Next.js dev reloads
const globalForOtp = globalThis as unknown as {
  __quevaa_otp_store?: Map<string, OtpRecord>;
  __quevaa_otp_cooldown?: Map<string, number>;
};

const otpStore: Map<string, OtpRecord> =
  globalForOtp.__quevaa_otp_store || (globalForOtp.__quevaa_otp_store = new Map());

const cooldownStore: Map<string, number> =
  globalForOtp.__quevaa_otp_cooldown || (globalForOtp.__quevaa_otp_cooldown = new Map());

/**
 * Generate a cryptographically secure 6-digit numeric code
 */
export function generateSixDigitOtp(): string {
  // Generates integer between 100000 and 999999
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Send an OTP to a phone number with cooldown & rate-limit check
 */
export async function sendOtp(
  rawPhone: string,
  doctorName?: string
): Promise<{
  success: boolean;
  message: string;
  normalizedPhone: string;
  cooldownSeconds?: number;
  mockOtp?: string;
  error?: string;
}> {
  const normalized = normalizePhone(rawPhone);
  const now = Date.now();

  // Check cooldown
  const lastSent = cooldownStore.get(normalized);
  if (lastSent && now - lastSent < RESEND_COOLDOWN_MS) {
    const remaining = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
    return {
      success: false,
      normalizedPhone: normalized,
      cooldownSeconds: remaining,
      message: `Please wait ${remaining}s before requesting a new OTP.`,
      error: `Please wait ${remaining}s before requesting a new OTP.`,
    };
  }

  // Generate 6-digit OTP
  const otp = generateSixDigitOtp();

  // Save to store
  otpStore.set(normalized, {
    phone: normalized,
    otp,
    createdAt: now,
    expiresAt: now + OTP_EXPIRY_MS,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
  });

  // Set cooldown
  cooldownStore.set(normalized, now);

  // Send notification via configured channel
  const sendResult = await sendOtpNotification({
    phone: normalized,
    otp,
    doctorName,
  });

  if (!sendResult.success && !sendResult.mockOtp) {
    return {
      success: false,
      normalizedPhone: normalized,
      message: 'Failed to dispatch OTP SMS. Please check your phone number.',
      error: sendResult.error || 'Failed to dispatch OTP',
    };
  }

  return {
    success: true,
    normalizedPhone: normalized,
    message: 'A 6-digit OTP has been sent to your phone number.',
    mockOtp: sendResult.mockOtp,
  };
}

/**
 * Securely verify an OTP for a given phone number
 */
export function verifyOtp(
  rawPhone: string,
  inputOtp: string
): {
  valid: boolean;
  reason?: string;
  remainingAttempts?: number;
} {
  const normalized = normalizePhone(rawPhone);
  const record = otpStore.get(normalized);
  const now = Date.now();

  if (!record) {
    return {
      valid: false,
      reason: 'No active OTP found for this mobile number. Please click "Send OTP".',
    };
  }

  if (now > record.expiresAt) {
    otpStore.delete(normalized);
    return {
      valid: false,
      reason: 'The OTP has expired (5 minutes limit). Please request a new OTP.',
    };
  }

  if (record.attempts >= record.maxAttempts) {
    otpStore.delete(normalized);
    return {
      valid: false,
      reason: 'Too many incorrect attempts. Please request a new OTP.',
      remainingAttempts: 0,
    };
  }

  const cleanInput = inputOtp.trim();

  if (record.otp !== cleanInput) {
    record.attempts += 1;
    const remaining = record.maxAttempts - record.attempts;

    if (remaining <= 0) {
      otpStore.delete(normalized);
      return {
        valid: false,
        reason: 'Too many incorrect attempts. Please request a new OTP.',
        remainingAttempts: 0,
      };
    }

    return {
      valid: false,
      reason: `Incorrect OTP. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`,
      remainingAttempts: remaining,
    };
  }

  // Valid OTP! Consume it so it cannot be reused
  otpStore.delete(normalized);

  return { valid: true };
}

/**
 * Helper to check cooldown status without sending
 */
export function getCooldownRemaining(rawPhone: string): number {
  const normalized = normalizePhone(rawPhone);
  const lastSent = cooldownStore.get(normalized);
  if (!lastSent) return 0;
  const elapsed = Date.now() - lastSent;
  if (elapsed >= RESEND_COOLDOWN_MS) return 0;
  return Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
}
