// ===========================================
// Quevaa — Database TypeScript Types
// ===========================================

export interface Hospital {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface Doctor {
  id: string;
  hospital_id: string;
  name: string;
  department: string | null;
  room_number: string | null;
  specialization: string | null;
  avg_consultation_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface QueueSession {
  id: string;
  doctor_id: string;
  session_date: string;
  current_token: number;
  total_tokens: number;
  status: 'open' | 'paused' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  consent_notifications: boolean;
  created_at: string;
}

export type QueueEntryStatus = 'waiting' | 'called' | 'completed' | 'skipped' | 'cancelled';

export interface QueueEntry {
  id: string;
  session_id: string;
  patient_id: string;
  token_number: number;
  status: QueueEntryStatus;
  priority: boolean;
  tracking_token: string;
  notified_approaching: boolean;
  notified_called: boolean;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
}

export type NotificationChannel = 'sms' | 'whatsapp';
export type NotificationType = 'registration' | 'approaching' | 'called';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'mocked';

export interface NotificationLog {
  id: string;
  queue_entry_id: string;
  patient_id: string;
  channel: NotificationChannel;
  notification_type: NotificationType;
  message_content: string | null;
  provider_message_id: string | null;
  status: NotificationStatus;
  error_message: string | null;
  created_at: string;
}

export type StaffRole = 'receptionist' | 'doctor' | 'admin';

export interface StaffUser {
  id: string;
  auth_user_id: string;
  email: string;
  name: string | null;
  role: StaffRole;
  hospital_id: string;
  is_active: boolean;
  created_at: string;
}

// ===========================================
// Joined / Composite Types (for frontend use)
// ===========================================

/** Queue status returned to the patient tracking page */
export interface PatientQueueStatus {
  tokenNumber: number;
  currentToken: number;
  patientsAhead: number;
  estimatedWaitMinutes: number;
  status: QueueEntryStatus;
  doctorName: string;
  roomNumber: string;
  department: string;
  queueStatus: QueueSession['status'];
  lastUpdated: string;
  trackingToken: string;
}

/** Check-in success response */
export interface CheckInResponse {
  success: true;
  tokenNumber: number;
  currentToken: number;
  doctorName: string;
  trackingToken: string;
  trackingUrl: string;
  patientName: string;
}

/** Queue entry with patient info (for staff dashboard) */
export interface QueueEntryWithPatient extends QueueEntry {
  patient: Patient;
}

/** Staff dashboard data */
export interface StaffDashboardData {
  session: QueueSession;
  doctor: Doctor;
  entries: QueueEntryWithPatient[];
  waitingCount: number;
  completedCount: number;
  totalCount: number;
}

/** API error response */
export interface ApiError {
  success: false;
  error: string;
  details?: string;
}
