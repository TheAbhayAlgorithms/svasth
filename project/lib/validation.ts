// ===========================================
// Zod Validation Schemas
// ===========================================

import { z } from 'zod';

/**
 * Indian phone number validation.
 * Accepts: +91XXXXXXXXXX, 91XXXXXXXXXX, 0XXXXXXXXXX, XXXXXXXXXX
 * Normalizes to +91XXXXXXXXXX format.
 */
const INDIAN_PHONE_REGEX = /^(?:\+?91|0)?[6-9]\d{9}$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(INDIAN_PHONE_REGEX, 'Please enter a valid Indian phone number');

/**
 * Normalize an Indian phone number to +91XXXXXXXXXX format.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-\(\)]/g, '');

  if (digits.startsWith('+91')) {
    return digits;
  }
  if (digits.startsWith('91') && digits.length === 12) {
    return '+' + digits;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return '+91' + digits.slice(1);
  }
  if (digits.length === 10) {
    return '+91' + digits;
  }

  return '+91' + digits;
}

/**
 * 6-digit numeric OTP schema
 */
export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

/**
 * Send OTP request schema
 */
export const sendOtpSchema = z.object({
  phone: phoneSchema,
  doctorId: z.string().min(1, 'Invalid doctor ID').optional(),
});

export type SendOtpInput = z.infer<typeof sendOtpSchema>;

/**
 * Check-in form schema (requires verified 6-digit OTP)
 */
export const checkInSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[a-zA-Z\s.''-]+$/, 'Name contains invalid characters'),
  phone: phoneSchema,
  consent: z
    .boolean()
    .refine((val) => val === true, 'You must consent to receive notifications'),
  doctorId: z.string().min(1, 'Invalid doctor ID'),
  otp: otpSchema,
});

export type CheckInInput = z.infer<typeof checkInSchema>;

/**
 * Staff action schema (for queue operations)
 */
export const staffActionSchema = z.object({
  sessionId: z.string().min(1, 'Invalid session ID'),
  doctorId: z.string().min(1, 'Invalid doctor ID').optional(),
});

export type StaffActionInput = z.infer<typeof staffActionSchema>;

/**
 * Priority patient schema
 */
export const priorityPatientSchema = z.object({
  sessionId: z.string().min(1, 'Invalid session ID'),
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  phone: phoneSchema,
  consent: z.boolean().default(true),
});

export type PriorityPatientInput = z.infer<typeof priorityPatientSchema>;

/**
 * Tracking token schema
 */
export const trackingTokenSchema = z.object({
  id: z.string().min(10, 'Invalid tracking token'),
});
