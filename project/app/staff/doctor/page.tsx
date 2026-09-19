'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ===========================================
// Doctor Queue Page
// Simple, focused view for doctors to manage their queue
// ===========================================

interface Doctor {
  id: string;
  name: string;
  department: string | null;
  room_number: string | null;
  todaySession: {
    id: string;
    current_token: number;
    total_tokens: number;
    status: string;
  } | null;
}

interface QueueEntry {
  id: string;
  token_number: number;
  status: string;
  priority: boolean;
  patient: {
    name: string;
  };
}

export default function DoctorQueuePage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [currentToken, setCurrentToken] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [queueStatus, setQueueStatus] = useState('open');
  const [waitingEntries, setWaitingEntries] = useState<QueueEntry[]>([]);
  const [currentPatient, setCurrentPatient] = useState<QueueEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const selectedDoctorRef = useRef('');
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  selectedDoctorRef.current = selectedDoctorId;

  const router = useRouter();

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setAuthenticated(true);
          setLoading(false);
          return;
        }
      } catch {
        // Ignore Supabase error and check mock session
      }

      const mockSession = localStorage.getItem('svasth_mock_staff');
      if (mockSession) {
        try {
          JSON.parse(mockSession);
          setAuthenticated(true);
        } catch {
          router.push('/staff/login');
        }
      } else {
        router.push('/staff/login');
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  // Fetch doctors
  const fetchDoctors = useCallback(async () => {
    try {
      const res = await fetch('/api/doctors');
      const data = await res.json();
      if (data.success) {
        setDoctors(data.doctors);
        if (data.doctors.length > 0 && !selectedDoctorRef.current) {
          setSelectedDoctorId(data.doctors[0].id);
        }
        return data.doctors as Doctor[];
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
    return [];
  }, []);

  // Refresh queue data
  const refreshQueue = useCallback(async () => {
    const docId = selectedDoctorRef.current;
    if (!docId) return;

    const freshDocs = await fetchDoctors();
    const doctor = freshDocs.find((d) => d.id === docId);
    if (!doctor?.todaySession) {
      setCurrentToken(0);
      setTotalTokens(0);
      setWaitingEntries([]);
      setCurrentPatient(null);
      return;
    }

    setCurrentToken(doctor.todaySession.current_token);
    setTotalTokens(doctor.todaySession.total_tokens);
    setQueueStatus(doctor.todaySession.status);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: entries } = await supabase
        .from('queue_entries')
        .select('*, patient:patients!inner(name)')
        .eq('session_id', doctor.todaySession.id)
        .order('token_number', { ascending: true });

      const all = (entries || []) as unknown as QueueEntry[];
      setWaitingEntries(all.filter((e) => e.status === 'waiting'));
      setCurrentPatient(all.find((e) => e.status === 'called') || null);
    } catch (err) {
      console.error('Error fetching entries:', err);
    }
  }, [fetchDoctors]);

  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => refreshQueue(), 300);
  }, [refreshQueue]);

  // Initial load
  useEffect(() => {
    if (authenticated) {
      fetchDoctors();
    }
  }, [authenticated, fetchDoctors]);

  useEffect(() => {
    if (selectedDoctorId) refreshQueue();
  }, [selectedDoctorId, refreshQueue]);

  // Realtime subscriptions
  useEffect(() => {
    if (!selectedDoctorId) return;
    const supabase = getSupabaseBrowserClient();

    const sessionChannel = supabase
      .channel(`doc-sessions-${selectedDoctorId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'queue_sessions',
        filter: `doctor_id=eq.${selectedDoctorId}`,
      }, () => debouncedRefresh())
      .subscribe();

    return () => { supabase.removeChannel(sessionChannel); };
  }, [selectedDoctorId, debouncedRefresh]);

  useEffect(() => {
    const doctor = doctors.find((d) => d.id === selectedDoctorId);
    const sessionId = doctor?.todaySession?.id;
    if (!sessionId) return;

    const supabase = getSupabaseBrowserClient();
    const entryChannel = supabase
      .channel(`doc-entries-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'queue_entries',
        filter: `session_id=eq.${sessionId}`,
      }, () => debouncedRefresh())
      .subscribe();

    return () => { supabase.removeChannel(entryChannel); };
  }, [doctors, selectedDoctorId, debouncedRefresh]);

  const showNotif = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAction = async (action: string) => {
    const doctor = doctors.find((d) => d.id === selectedDoctorId);
    if (!doctor?.todaySession) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/queue/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: doctor.todaySession.id }),
      });
      const data = await res.json();
      if (data.success) {
        showNotif('success', action === 'next' ? 'Next patient called' : `${action} successful`);
        refreshQueue();
      } else {
        showNotif('error', data.error || `Failed: ${action}`);
      }
    } catch {
      showNotif('error', 'Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    localStorage.removeItem('svasth_mock_staff');
    router.push('/staff/login');
  };

  if (loading || !authenticated) {
    return (
      <div className="page-container">
        <div className="queue-status-loading">
          <div className="pulse-ring" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);
  const waitingCount = waitingEntries.length;

  return (
    <div className="page-container dashboard-page">
      {/* Nav */}
      <nav className="dashboard-nav">
        <div className="nav-container">
          <div className="nav-brand">
            <Link href="/" className="nav-brand-link">
              <div className="nav-logo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <span className="nav-title">SVASTH Queue</span>
            </Link>
            <span className="nav-divider" />
            <span className="nav-subtitle">Doctor View</span>
          </div>
          <div className="nav-right">
            <Link href="/staff/dashboard" className="btn btn-ghost btn-sm">
              Full Dashboard
            </Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Toast */}
      {notification && (
        <div className={`toast toast-${notification.type}`}>
          {notification.type === 'success' ? '✓' : '✕'} {notification.message}
        </div>
      )}

      <div className="dashboard-content">
        {/* Doctor Selector */}
        {doctors.length > 1 && (
          <div className="doctor-select-wrapper" style={{ marginBottom: 24, maxWidth: 400 }}>
            <label htmlFor="doc-select" className="form-label">Select Doctor</label>
            <select
              id="doc-select"
              className="form-select"
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.department || 'General'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Hero: Current Token */}
        <div className="doctor-queue-hero">
          <div className="doctor-queue-info">
            <h2>{selectedDoctor?.name}</h2>
            <p>{selectedDoctor?.department} · Room {selectedDoctor?.room_number || 'N/A'}</p>
          </div>

          <div className="doctor-queue-current">
            <span className="doctor-queue-label">Now Serving</span>
            <span className="doctor-queue-token">
              {currentToken > 0 ? `#${currentToken}` : '—'}
            </span>
            {currentPatient && (
              <span className="doctor-queue-patient-name">{currentPatient.patient.name}</span>
            )}
            <span className={`queue-status-badge queue-${queueStatus}`}>
              {queueStatus.charAt(0).toUpperCase() + queueStatus.slice(1)}
            </span>
          </div>

          <div className="doctor-queue-stats">
            <div className="doctor-stat">
              <span className="doctor-stat-value">{waitingCount}</span>
              <span className="doctor-stat-label">Waiting</span>
            </div>
            <div className="doctor-stat">
              <span className="doctor-stat-value">{totalTokens}</span>
              <span className="doctor-stat-label">Total Today</span>
            </div>
          </div>
        </div>

        {/* Main Action: Next Patient */}
        <div className="doctor-actions">
          <button
            onClick={() => handleAction('next')}
            disabled={actionLoading || queueStatus !== 'open' || waitingCount === 0}
            className="btn btn-primary btn-next-patient"
          >
            {actionLoading ? (
              <span className="spinner" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="28" height="28">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            )}
            Next Patient
          </button>

          <div className="doctor-secondary-actions">
            <button
              onClick={() => handleAction('skip')}
              disabled={actionLoading || queueStatus !== 'open'}
              className="btn btn-secondary"
            >
              Skip
            </button>
            <button
              onClick={() => handleAction('recall')}
              disabled={actionLoading || currentToken === 0}
              className="btn btn-secondary"
            >
              Recall
            </button>
            {queueStatus === 'open' ? (
              <button
                onClick={() => handleAction('pause')}
                disabled={actionLoading}
                className="btn btn-warning"
              >
                Pause
              </button>
            ) : queueStatus === 'paused' ? (
              <button
                onClick={() => handleAction('resume')}
                disabled={actionLoading}
                className="btn btn-success"
              >
                Resume
              </button>
            ) : null}
          </div>
        </div>

        {/* Waiting List */}
        {waitingEntries.length > 0 && (
          <div className="doctor-waiting-list">
            <h3 className="section-title">Up Next</h3>
            <div className="waiting-chips">
              {waitingEntries.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className={`waiting-chip ${entry.priority ? 'waiting-chip-priority' : ''}`}
                >
                  <span className="waiting-chip-token">#{entry.token_number}</span>
                  <span className="waiting-chip-name">{entry.patient.name}</span>
                  {entry.priority && <span className="badge badge-priority">⭐</span>}
                </div>
              ))}
              {waitingEntries.length > 10 && (
                <div className="waiting-chip waiting-chip-more">
                  +{waitingEntries.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
