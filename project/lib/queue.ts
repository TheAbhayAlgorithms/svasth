// ===========================================
// Queue Business Logic
// Central module for all queue operations
// ===========================================

import { createServiceClient } from './supabase-server';
import { normalizePhone } from './validation';
import {
  triggerRegistrationNotification,
  triggerApproachingNotification,
  triggerCalledNotification,
} from './notifications';
import { nanoid } from 'nanoid';
import type { QueueEntry, QueueSession, Doctor, Patient } from '@/types/database';
import { mockStore } from './mock-store';

// ===========================================
// Find or Create Queue Session for Today
// ===========================================

export async function getOrCreateTodaySession(doctorId: string): Promise<QueueSession> {
  try {
    const supabase = createServiceClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: existing, error } = await supabase
      .from('queue_sessions')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('session_date', today)
      .single();

    if (!error && existing) return existing as QueueSession;

    const { data: created, error: createError } = await supabase
      .from('queue_sessions')
      .insert({
        doctor_id: doctorId,
        session_date: today,
        current_token: 0,
        total_tokens: 0,
        status: 'open',
      })
      .select()
      .single();

    if (!createError && created) return created as QueueSession;
  } catch (err) {
    console.warn('Supabase session query warning, using mockStore fallback:', err);
  }

  return mockStore.getOrCreateSession(doctorId);
}

// ===========================================
// Find or Create Patient
// ===========================================

export async function findOrCreatePatient(
  name: string,
  phone: string,
  consent: boolean
): Promise<Patient> {
  const normalizedPhone = normalizePhone(phone);
  try {
    const supabase = createServiceClient();

    const { data: existing } = await supabase
      .from('patients')
      .select('*')
      .eq('phone', normalizedPhone)
      .single();

    if (existing) {
      if (existing.name !== name || existing.consent_notifications !== consent) {
        await supabase
          .from('patients')
          .update({ name, consent_notifications: consent })
          .eq('id', existing.id);
      }
      return { ...existing, name, consent_notifications: consent } as Patient;
    }

    const { data: created, error } = await supabase
      .from('patients')
      .insert({
        name,
        phone: normalizedPhone,
        consent_notifications: consent,
      })
      .select()
      .single();

    if (!error && created) return created as Patient;
  } catch (err) {
    console.warn('Supabase patient query warning, using mockStore fallback:', err);
  }

  return mockStore.findOrCreatePatient(name, normalizedPhone, consent);
}

// ===========================================
// Join Queue (Patient Check-in)
// ===========================================

export async function joinQueue(params: {
  doctorId: string;
  name: string;
  phone: string;
  consent: boolean;
}): Promise<{
  entry: QueueEntry;
  session: QueueSession;
  patient: Patient;
  doctor: Doctor;
}> {
  try {
    const supabase = createServiceClient();

    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', params.doctorId)
      .eq('is_active', true)
      .single();

    if (doctorError || !doctor) {
      throw new Error('Doctor not found');
    }

    const session = await getOrCreateTodaySession(params.doctorId);
    if (session.status === 'closed') {
      throw new Error('Queue is closed for today. Please try again tomorrow.');
    }

    const patient = await findOrCreatePatient(params.name, params.phone, params.consent);

    const { data: existingEntry } = await supabase
      .from('queue_entries')
      .select('*')
      .eq('session_id', session.id)
      .eq('patient_id', patient.id)
      .in('status', ['waiting', 'called'])
      .single();

    if (existingEntry) {
      return {
        entry: existingEntry as QueueEntry,
        session,
        patient,
        doctor: doctor as Doctor,
      };
    }

    const { data: tokenResult, error: tokenError } = await supabase.rpc(
      'generate_next_token',
      { target_session_id: session.id }
    );

    if (tokenError) {
      throw new Error(`Failed to generate token: ${tokenError.message}`);
    }

    const tokenNumber = tokenResult as number;
    const trackingToken = nanoid(21);

    const { data: entry, error: entryError } = await supabase
      .from('queue_entries')
      .insert({
        session_id: session.id,
        patient_id: patient.id,
        token_number: tokenNumber,
        status: 'waiting',
        priority: false,
        tracking_token: trackingToken,
      })
      .select()
      .single();

    if (entryError) {
      throw new Error(`Failed to create queue entry: ${entryError.message}`);
    }

    if (patient.consent_notifications) {
      triggerRegistrationNotification({
        queueEntryId: entry.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorName: doctor.name,
        tokenNumber,
        currentToken: session.current_token,
        trackingToken,
      }).catch((err) => console.error('Notification error:', err));
    }

    return {
      entry: entry as QueueEntry,
      session,
      patient,
      doctor: doctor as Doctor,
    };
  } catch (err) {
    console.warn('Supabase joinQueue warning, using mockStore fallback:', err);
    return mockStore.joinQueue(params) as unknown as {
      entry: QueueEntry;
      session: QueueSession;
      patient: Patient;
      doctor: Doctor;
    };
  }
}

// ===========================================
// Get Queue Status for Patient
// ===========================================

export async function getQueueStatus(trackingToken: string) {
  try {
    const supabase = createServiceClient();

    const { data: entry, error } = await supabase
      .from('queue_entries')
      .select(`
        *,
        session:queue_sessions!inner (
          *,
          doctor:doctors!inner (*)
        )
      `)
      .eq('tracking_token', trackingToken)
      .single();

    if (!error && entry) {
      const session = (entry as Record<string, unknown>).session as QueueSession & { doctor: Doctor };
      const doctor = session.doctor;

      const { count: patientsAhead } = await supabase
        .from('queue_entries')
        .select('*', { count: 'exact', head: true })
        .eq('session_id', session.id)
        .eq('status', 'waiting')
        .lt('token_number', (entry as QueueEntry).token_number);

      const ahead = patientsAhead ?? 0;
      const estimatedWait = ahead * (doctor.avg_consultation_minutes || 10);

      return {
        tokenNumber: (entry as QueueEntry).token_number,
        currentToken: session.current_token,
        patientsAhead: ahead,
        estimatedWaitMinutes: estimatedWait,
        status: (entry as QueueEntry).status,
        doctorName: doctor.name,
        roomNumber: doctor.room_number || 'N/A',
        department: doctor.department || 'General',
        queueStatus: session.status,
        lastUpdated: session.updated_at,
        trackingToken: (entry as QueueEntry).tracking_token,
        sessionId: session.id,
      };
    }
  } catch (err) {
    console.warn('Supabase getQueueStatus warning, using mockStore fallback:', err);
  }

  return mockStore.getQueueStatus(trackingToken);
}

// ===========================================
// Advance Queue (Next Patient)
// ===========================================

export async function advanceQueue(sessionId: string) {
  try {
    const supabase = createServiceClient();

    const { data: session } = await supabase
      .from('queue_sessions')
      .select('*, doctor:doctors!inner(*)')
      .eq('id', sessionId)
      .single();

    if (!session) throw new Error('Session not found');
    if ((session as QueueSession).status !== 'open') throw new Error('Queue is not open');

    const doctor = (session as Record<string, unknown>).doctor as Doctor;

    const { data: newToken, error } = await supabase.rpc('advance_queue', {
      target_session_id: sessionId,
    });

    if (error) throw new Error(`Failed to advance queue: ${error.message}`);

    const { data: calledEntry } = await supabase
      .from('queue_entries')
      .select('*, patient:patients!inner(*)')
      .eq('session_id', sessionId)
      .eq('token_number', newToken)
      .single();

    if (calledEntry) {
      const patient = (calledEntry as Record<string, unknown>).patient as Patient;
      if (patient.consent_notifications) {
        triggerCalledNotification({
          queueEntryId: (calledEntry as QueueEntry).id,
          patientId: patient.id,
          patientName: patient.name,
          patientPhone: patient.phone,
          tokenNumber: newToken as number,
          doctorName: doctor.name,
          roomNumber: doctor.room_number || 'N/A',
        }).catch((err) => console.error('Called notification error:', err));
      }
    }

    const approachingTokens = [(newToken as number) + 1, (newToken as number) + 2];
    const { data: approachingEntries } = await supabase
      .from('queue_entries')
      .select('*, patient:patients!inner(*)')
      .eq('session_id', sessionId)
      .in('token_number', approachingTokens)
      .eq('status', 'waiting')
      .eq('notified_approaching', false);

    if (approachingEntries) {
      for (const approachEntry of approachingEntries) {
        const patient = (approachEntry as Record<string, unknown>).patient as Patient;
        if (patient.consent_notifications) {
          triggerApproachingNotification({
            queueEntryId: (approachEntry as QueueEntry).id,
            patientId: patient.id,
            patientName: patient.name,
            patientPhone: patient.phone,
            tokenNumber: (approachEntry as QueueEntry).token_number,
            currentToken: newToken as number,
            doctorName: doctor.name,
            roomNumber: doctor.room_number || 'N/A',
            trackingToken: (approachEntry as QueueEntry).tracking_token,
          }).catch((err) => console.error('Approaching notification error:', err));
        }
      }
    }

    return { newToken, sessionId };
  } catch (err) {
    console.warn('Supabase advanceQueue warning, using mockStore fallback:', err);
    return mockStore.advanceQueue(sessionId);
  }
}

// ===========================================
// Skip Patient
// ===========================================

export async function skipPatient(sessionId: string) {
  try {
    const supabase = createServiceClient();

    const { data: session } = await supabase
      .from('queue_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (session) {
      await supabase
        .from('queue_entries')
        .update({ status: 'skipped' })
        .eq('session_id', sessionId)
        .eq('token_number', (session as QueueSession).current_token)
        .in('status', ['called', 'waiting']);

      return await advanceQueue(sessionId);
    }
  } catch (err) {
    console.warn('Supabase skipPatient warning, using mockStore fallback:', err);
  }

  return mockStore.skipPatient(sessionId);
}

// ===========================================
// Recall Patient
// ===========================================

export async function recallPatient(sessionId: string) {
  try {
    const supabase = createServiceClient();

    const { data: session } = await supabase
      .from('queue_sessions')
      .select('*, doctor:doctors!inner(*)')
      .eq('id', sessionId)
      .single();

    if (session) {
      const doctor = (session as Record<string, unknown>).doctor as Doctor;

      const { data: currentEntry } = await supabase
        .from('queue_entries')
        .select('*, patient:patients!inner(*)')
        .eq('session_id', sessionId)
        .eq('token_number', (session as QueueSession).current_token)
        .single();

      if (currentEntry) {
        const patient = (currentEntry as Record<string, unknown>).patient as Patient;

        if (patient.consent_notifications) {
          await triggerCalledNotification({
            queueEntryId: (currentEntry as QueueEntry).id,
            patientId: patient.id,
            patientName: patient.name,
            patientPhone: patient.phone,
            tokenNumber: (currentEntry as QueueEntry).token_number,
            doctorName: doctor.name,
            roomNumber: doctor.room_number || 'N/A',
          });
        }

        return { recalled: true, tokenNumber: (currentEntry as QueueEntry).token_number };
      }
    }
  } catch (err) {
    console.warn('Supabase recallPatient warning, using mockStore fallback:', err);
  }

  return mockStore.recallPatient(sessionId);
}

// ===========================================
// Pause / Resume / Reset Queue
// ===========================================

export async function pauseQueue(sessionId: string) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('queue_sessions')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (!error) return { status: 'paused' };
  } catch (err) {
    console.warn('Supabase pauseQueue warning, using mockStore fallback:', err);
  }
  return mockStore.pauseQueue(sessionId);
}

export async function resumeQueue(sessionId: string) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('queue_sessions')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', sessionId);
    if (!error) return { status: 'open' };
  } catch (err) {
    console.warn('Supabase resumeQueue warning, using mockStore fallback:', err);
  }
  return mockStore.resumeQueue(sessionId);
}

export async function resetQueue(sessionId: string) {
  try {
    const supabase = createServiceClient();

    await supabase
      .from('queue_entries')
      .update({ status: 'cancelled' })
      .eq('session_id', sessionId)
      .in('status', ['waiting', 'called']);

    const { error } = await supabase
      .from('queue_sessions')
      .update({
        current_token: 0,
        total_tokens: 0,
        status: 'closed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (!error) return { status: 'closed', reset: true };
  } catch (err) {
    console.warn('Supabase resetQueue warning, using mockStore fallback:', err);
  }
  return mockStore.resetQueue(sessionId);
}

// ===========================================
// Add Priority Patient
// ===========================================

export async function addPriorityPatient(params: {
  sessionId: string;
  name: string;
  phone: string;
  consent: boolean;
}) {
  try {
    const supabase = createServiceClient();

    const { data: session } = await supabase
      .from('queue_sessions')
      .select('*, doctor:doctors!inner(*)')
      .eq('id', params.sessionId)
      .single();

    if (session) {
      const doctor = (session as Record<string, unknown>).doctor as Doctor;
      const patient = await findOrCreatePatient(params.name, params.phone, params.consent);

      const { data: tokenResult, error: tokenError } = await supabase.rpc(
        'generate_next_token',
        { target_session_id: params.sessionId }
      );

      if (!tokenError) {
        const tokenNumber = tokenResult as number;
        const trackingToken = nanoid(21);

        const { data: entry, error: entryError } = await supabase
          .from('queue_entries')
          .insert({
            session_id: params.sessionId,
            patient_id: patient.id,
            token_number: tokenNumber,
            status: 'waiting',
            priority: true,
            tracking_token: trackingToken,
          })
          .select()
          .single();

        if (!entryError && entry) {
          if (patient.consent_notifications) {
            triggerRegistrationNotification({
              queueEntryId: entry.id,
              patientId: patient.id,
              patientName: patient.name,
              patientPhone: patient.phone,
              doctorName: doctor.name,
              tokenNumber,
              currentToken: (session as QueueSession).current_token,
              trackingToken,
            }).catch((err) => console.error('Priority notification error:', err));
          }

          return { entry, patient, tokenNumber, trackingToken };
        }
      }
    }
  } catch (err) {
    console.warn('Supabase addPriorityPatient warning, using mockStore fallback:', err);
  }

  return mockStore.addPriorityPatient(params);
}

// ===========================================
// Get Staff Dashboard Data
// ===========================================

export async function getStaffDashboardData(sessionId: string) {
  try {
    const supabase = createServiceClient();

    const { data: session, error: sessionError } = await supabase
      .from('queue_sessions')
      .select('*, doctor:doctors!inner(*)')
      .eq('id', sessionId)
      .single();

    if (!sessionError && session) {
      const { data: entries } = await supabase
        .from('queue_entries')
        .select('*, patient:patients!inner(*)')
        .eq('session_id', sessionId)
        .order('token_number', { ascending: true });

      const allEntries = (entries || []) as (QueueEntry & { patient: Patient })[];

      return {
        session: session as QueueSession & { doctor: Doctor },
        doctor: (session as Record<string, unknown>).doctor as Doctor,
        entries: allEntries,
        waitingCount: allEntries.filter((e) => e.status === 'waiting').length,
        completedCount: allEntries.filter((e) => e.status === 'completed').length,
        totalCount: allEntries.length,
      };
    }
  } catch (err) {
    console.warn('Supabase getStaffDashboardData warning, using mockStore fallback:', err);
  }

  return mockStore.getDashboardData(sessionId);
}
