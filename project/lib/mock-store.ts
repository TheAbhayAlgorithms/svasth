// ===========================================
// SVASTH Queue — In-Memory Mock Store Fallback
// Provides seamless out-of-the-box functionality
// when Supabase tables are not created or accessible.
// ===========================================

import { nanoid } from 'nanoid';
import type { Doctor, QueueSession, Patient, QueueEntry } from '@/types/database';

export const MOCK_HOSPITAL = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'SVASTH General Hospital',
  address: '123 Medical Avenue, New Delhi, India 110001',
  phone: '+91-11-2345-6789',
};

export const MOCK_DOCTORS: (Doctor & { todaySession?: QueueSession | null })[] = [
  {
    id: 'd1000001-0000-0000-0000-000000000001',
    hospital_id: MOCK_HOSPITAL.id,
    name: 'Dr. Priya Sharma',
    department: 'General Medicine',
    room_number: '101',
    specialization: 'Internal Medicine',
    avg_consultation_minutes: 8,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000002',
    hospital_id: MOCK_HOSPITAL.id,
    name: 'Dr. Rajesh Patel',
    department: 'Orthopedics',
    room_number: '205',
    specialization: 'Joint & Bone Specialist',
    avg_consultation_minutes: 12,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'd1000001-0000-0000-0000-000000000003',
    hospital_id: MOCK_HOSPITAL.id,
    name: 'Dr. Ananya Gupta',
    department: 'Pediatrics',
    room_number: '310',
    specialization: 'Child Healthcare',
    avg_consultation_minutes: 10,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Global state in memory for mock operations
const today = new Date().toISOString().split('T')[0];

const sessions: Map<string, QueueSession> = new Map();
const patients: Map<string, Patient> = new Map();
const queueEntries: Map<string, QueueEntry> = new Map();

// Initialize default sessions for mock doctors
MOCK_DOCTORS.forEach((doc) => {
  const sessionId = `session-${doc.id}-${today}`;
  sessions.set(sessionId, {
    id: sessionId,
    doctor_id: doc.id,
    session_date: today,
    current_token: 0,
    total_tokens: 0,
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
});

export const mockStore = {
  getDoctors() {
    return MOCK_DOCTORS.map((doc) => {
      const sessionId = `session-${doc.id}-${today}`;
      const session = sessions.get(sessionId) || null;
      return {
        ...doc,
        hospital: { name: MOCK_HOSPITAL.name },
        todaySession: session,
      };
    });
  },

  getDoctor(id: string) {
    const doc = MOCK_DOCTORS.find((d) => d.id === id);
    if (!doc) return null;
    return {
      ...doc,
      hospital: { name: MOCK_HOSPITAL.name },
    };
  },

  getOrCreateSession(doctorId: string): QueueSession {
    const sessionId = `session-${doctorId}-${today}`;
    let session = sessions.get(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        doctor_id: doctorId,
        session_date: today,
        current_token: 0,
        total_tokens: 0,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      sessions.set(sessionId, session);
    }
    return session;
  },

  findOrCreatePatient(name: string, phone: string, consent: boolean): Patient {
    const existing = Array.from(patients.values()).find((p) => p.phone === phone);
    if (existing) {
      existing.name = name;
      existing.consent_notifications = consent;
      return existing;
    }
    const patient: Patient = {
      id: `patient-${nanoid(8)}`,
      name,
      phone,
      consent_notifications: consent,
      created_at: new Date().toISOString(),
    };
    patients.set(patient.id, patient);
    return patient;
  },

  joinQueue(params: { doctorId: string; name: string; phone: string; consent: boolean }) {
    const doc = this.getDoctor(params.doctorId);
    if (!doc) throw new Error('Doctor not found');

    const session = this.getOrCreateSession(params.doctorId);
    if (session.status === 'closed') {
      throw new Error('Queue is closed for today. Please try again tomorrow.');
    }

    const patient = this.findOrCreatePatient(params.name, params.phone, params.consent);

    // Check existing
    const existingEntry = Array.from(queueEntries.values()).find(
      (e) => e.session_id === session.id && e.patient_id === patient.id && ['waiting', 'called'].includes(e.status)
    );

    if (existingEntry) {
      return { entry: existingEntry, session, patient, doctor: doc };
    }

    session.total_tokens += 1;
    session.updated_at = new Date().toISOString();

    const entry: QueueEntry = {
      id: `entry-${nanoid(10)}`,
      session_id: session.id,
      patient_id: patient.id,
      token_number: session.total_tokens,
      status: 'waiting',
      priority: false,
      notified_approaching: false,
      notified_called: false,
      tracking_token: nanoid(21),
      created_at: new Date().toISOString(),
      called_at: null,
      completed_at: null,
    };

    queueEntries.set(entry.id, entry);
    return { entry, session, patient, doctor: doc };
  },

  getQueueStatus(trackingToken: string) {
    const entry = Array.from(queueEntries.values()).find((e) => e.tracking_token === trackingToken);
    if (!entry) return null;

    const session = Array.from(sessions.values()).find((s) => s.id === entry.session_id);
    if (!session) return null;

    const doctor = MOCK_DOCTORS.find((d) => d.id === session.doctor_id);
    if (!doctor) return null;

    const patientsAhead = Array.from(queueEntries.values()).filter(
      (e) => e.session_id === session.id && e.status === 'waiting' && e.token_number < entry.token_number
    ).length;

    return {
      tokenNumber: entry.token_number,
      currentToken: session.current_token,
      patientsAhead,
      estimatedWaitMinutes: patientsAhead * (doctor.avg_consultation_minutes || 10),
      status: entry.status,
      doctorName: doctor.name,
      roomNumber: doctor.room_number || 'N/A',
      department: doctor.department || 'General',
      queueStatus: session.status,
      lastUpdated: session.updated_at,
      trackingToken: entry.tracking_token,
      sessionId: session.id,
    };
  },

  advanceQueue(sessionId: string) {
    const session = Array.from(sessions.values()).find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    if (session.status !== 'open') throw new Error('Queue is not open');

    // Mark current token as completed if called
    if (session.current_token > 0) {
      const currentEntry = Array.from(queueEntries.values()).find(
        (e) => e.session_id === sessionId && e.token_number === session.current_token
      );
      if (currentEntry && currentEntry.status === 'called') {
        currentEntry.status = 'completed';
        currentEntry.completed_at = new Date().toISOString();
      }
    }

    // Find next waiting entry (priority first, then lowest token number)
    const waitingEntries = Array.from(queueEntries.values())
      .filter((e) => e.session_id === sessionId && e.status === 'waiting')
      .sort((a, b) => {
        if (a.priority && !b.priority) return -1;
        if (!a.priority && b.priority) return 1;
        return a.token_number - b.token_number;
      });

    if (waitingEntries.length > 0) {
      const nextEntry = waitingEntries[0];
      nextEntry.status = 'called';
      nextEntry.called_at = new Date().toISOString();
      session.current_token = nextEntry.token_number;
    } else {
      session.current_token = Math.min(session.current_token + 1, session.total_tokens);
    }

    session.updated_at = new Date().toISOString();
    return { newToken: session.current_token, sessionId };
  },

  skipPatient(sessionId: string) {
    const session = Array.from(sessions.values()).find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    const currentEntry = Array.from(queueEntries.values()).find(
      (e) => e.session_id === sessionId && e.token_number === session.current_token && ['called', 'waiting'].includes(e.status)
    );

    if (currentEntry) {
      currentEntry.status = 'skipped';
    }

    return this.advanceQueue(sessionId);
  },

  recallPatient(sessionId: string) {
    const session = Array.from(sessions.values()).find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    const currentEntry = Array.from(queueEntries.values()).find(
      (e) => e.session_id === sessionId && e.token_number === session.current_token
    );

    if (!currentEntry) throw new Error('No current patient to recall');
    return { recalled: true, tokenNumber: currentEntry.token_number };
  },

  pauseQueue(sessionId: string) {
    const session = Array.from(sessions.values()).find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    session.status = 'paused';
    session.updated_at = new Date().toISOString();
    return { status: 'paused' };
  },

  resumeQueue(sessionId: string) {
    const session = Array.from(sessions.values()).find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    session.status = 'open';
    session.updated_at = new Date().toISOString();
    return { status: 'open' };
  },

  resetQueue(sessionId: string) {
    const session = Array.from(sessions.values()).find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    Array.from(queueEntries.values())
      .filter((e) => e.session_id === sessionId && ['waiting', 'called'].includes(e.status))
      .forEach((e) => {
        e.status = 'cancelled';
      });

    session.current_token = 0;
    session.total_tokens = 0;
    session.status = 'closed';
    session.updated_at = new Date().toISOString();

    return { status: 'closed', reset: true };
  },

  addPriorityPatient(params: { sessionId: string; name: string; phone: string; consent: boolean }) {
    const session = Array.from(sessions.values()).find((s) => s.id === params.sessionId);
    if (!session) throw new Error('Session not found');

    const patient = this.findOrCreatePatient(params.name, params.phone, params.consent);
    session.total_tokens += 1;
    session.updated_at = new Date().toISOString();

    const entry: QueueEntry = {
      id: `entry-${nanoid(10)}`,
      session_id: session.id,
      patient_id: patient.id,
      token_number: session.total_tokens,
      status: 'waiting',
      priority: true,
      notified_approaching: false,
      notified_called: false,
      tracking_token: nanoid(21),
      created_at: new Date().toISOString(),
      called_at: null,
      completed_at: null,
    };

    queueEntries.set(entry.id, entry);
    return { entry, patient, tokenNumber: entry.token_number, trackingToken: entry.tracking_token };
  },

  getDashboardData(sessionId: string) {
    const session = Array.from(sessions.values()).find((s) => s.id === sessionId);
    if (!session) throw new Error('Session not found');

    const doctor = MOCK_DOCTORS.find((d) => d.id === session.doctor_id);

    const entries = Array.from(queueEntries.values())
      .filter((e) => e.session_id === sessionId)
      .map((e) => ({
        ...e,
        patient: patients.get(e.patient_id) || { id: e.patient_id, name: 'Patient', phone: '9999999999', consent_notifications: false, created_at: '' },
      }))
      .sort((a, b) => a.token_number - b.token_number);

    return {
      session: {
        ...session,
        doctor,
      },
      doctor,
      entries,
      waitingCount: entries.filter((e) => e.status === 'waiting').length,
      completedCount: entries.filter((e) => e.status === 'completed').length,
      totalCount: entries.length,
    };
  },
};
