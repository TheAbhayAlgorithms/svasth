'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import QRCodeDisplay from './QRCodeDisplay';

// ===========================================
// StaffControls Component
// Full staff dashboard with queue management
// ===========================================

interface Doctor {
  id: string;
  name: string;
  department: string | null;
  room_number: string | null;
  avg_consultation_minutes: number;
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
  tracking_token: string;
  created_at: string;
  called_at: string | null;
  completed_at: string | null;
  patient: {
    id: string;
    name: string;
    phone: string;
  };
}

interface DashboardData {
  session: {
    id: string;
    current_token: number;
    total_tokens: number;
    status: string;
    doctor: Doctor;
  };
  entries: QueueEntry[];
  waitingCount: number;
  completedCount: number;
  totalCount: number;
}

export default function StaffControls() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showPriorityForm, setShowPriorityForm] = useState(false);
  const [priorityName, setPriorityName] = useState('');
  const [priorityPhone, setPriorityPhone] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch doctors list
  useEffect(() => {
    fetch('/api/doctors')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setDoctors(data.doctors);
          if (data.doctors.length > 0 && !selectedDoctorId) {
            setSelectedDoctorId(data.doctors[0].id);
          }
        }
      })
      .catch(console.error);
  }, [selectedDoctorId]);

  // Fetch dashboard data for selected doctor
  const fetchDashboard = useCallback(async () => {
    if (!selectedDoctorId) return;

    const doctor = doctors.find((d) => d.id === selectedDoctorId);
    if (!doctor?.todaySession) {
      setDashboard(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/queue/dashboard?sessionId=${doctor.todaySession.id}`);
      const data = await res.json();

      if (data.success) {
        setDashboard({
          session: data.session,
          entries: data.entries || [],
          waitingCount: data.waitingCount || 0,
          completedCount: data.completedCount || 0,
          totalCount: data.totalCount || 0,
        });
      } else {
        // Fallback to client Supabase query if needed
        const supabase = getSupabaseBrowserClient();
        const { data: entries } = await supabase
          .from('queue_entries')
          .select('*, patient:patients!inner(*)')
          .eq('session_id', doctor.todaySession.id)
          .order('token_number', { ascending: true });

        const allEntries = (entries || []) as unknown as QueueEntry[];

        setDashboard({
          session: {
            ...doctor.todaySession,
            doctor: doctor,
          },
          entries: allEntries,
          waitingCount: allEntries.filter((e) => e.status === 'waiting').length,
          completedCount: allEntries.filter((e) => e.status === 'completed').length,
          totalCount: allEntries.length,
        });
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDoctorId, doctors]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Real-time subscription & fallback polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboard();
    }, 3000);

    if (!dashboard?.session?.id) {
      return () => clearInterval(interval);
    }

    let channel: RealtimeChannel | null = null;
    let supabase: SupabaseClient | null = null;

    try {
      supabase = getSupabaseBrowserClient();
      channel = supabase
        .channel(`staff-queue-${dashboard.session.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'queue_sessions',
            filter: `id=eq.${dashboard.session.id}`,
          },
          () => {
            fetch('/api/doctors')
              .then((r) => r.json())
              .then((data) => {
                if (data.success) setDoctors(data.doctors);
              });
            fetchDashboard();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'queue_entries',
            filter: `session_id=eq.${dashboard.session.id}`,
          },
          () => {
            fetchDashboard();
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Realtime subscription fallback active:', err);
    }

    return () => {
      clearInterval(interval);
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [dashboard?.session?.id, fetchDashboard]);

  const showNotif = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Staff actions
  const performAction = async (action: string, extraBody?: Record<string, unknown>) => {
    if (!dashboard?.session?.id) return;
    setActionLoading(action);

    try {
      const response = await fetch(`/api/queue/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: dashboard.session.id,
          ...extraBody,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showNotif('success', `${action.charAt(0).toUpperCase() + action.slice(1)} successful`);
        fetchDashboard();
        // Refresh doctors for session updates
        const dr = await fetch('/api/doctors').then((r) => r.json());
        if (dr.success) setDoctors(dr.doctors);
      } else {
        showNotif('error', data.error || `Failed to ${action}`);
      }
    } catch {
      showNotif('error', `Network error during ${action}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrioritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboard?.session?.id || !priorityName || !priorityPhone) return;

    setActionLoading('priority');
    try {
      const response = await fetch('/api/queue/priority', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: dashboard.session.id,
          name: priorityName,
          phone: priorityPhone,
          consent: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        showNotif('success', `Priority patient added: Token #${data.tokenNumber}`);
        setPriorityName('');
        setPriorityPhone('');
        setShowPriorityForm(false);
        fetchDashboard();
      } else {
        showNotif('error', data.error || 'Failed to add priority patient');
      }
    } catch {
      showNotif('error', 'Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'badge-waiting';
      case 'called': return 'badge-called';
      case 'completed': return 'badge-completed';
      case 'skipped': return 'badge-skipped';
      default: return 'badge-default';
    }
  };

  return (
    <div className="staff-controls">
      {/* Notification Toast */}
      {notification && (
        <div className={`toast toast-${notification.type}`}>
          {notification.type === 'success' ? '✓' : '✕'} {notification.message}
        </div>
      )}

      {/* Doctor Selector */}
      <div className="staff-header">
        <div className="doctor-select-wrapper">
          <label htmlFor="doctor-select" className="form-label">
            Select Doctor
          </label>
          <select
            id="doctor-select"
            className="form-select"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          >
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name} — {doc.department || 'General'} (Room {doc.room_number || 'N/A'})
              </option>
            ))}
          </select>
        </div>

        <div className="staff-header-actions">
          <button
            onClick={() => setShowQR(!showQR)}
            className="btn btn-secondary btn-sm"
          >
            {showQR ? 'Hide QR' : 'Show QR Code'}
          </button>
        </div>
      </div>

      {/* QR Code Panel */}
      {showQR && selectedDoctor && (
        <QRCodeDisplay
          doctorId={selectedDoctor.id}
          doctorName={selectedDoctor.name}
          department={selectedDoctor.department || 'General'}
          roomNumber={selectedDoctor.room_number || 'N/A'}
        />
      )}

      {/* Loading State */}
      {loading && (
        <div className="staff-loading">
          <div className="spinner" />
          <p>Loading dashboard...</p>
        </div>
      )}

      {/* No Session */}
      {!loading && !dashboard && selectedDoctor && (
        <div className="no-session-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <h3>No Queue Session Today</h3>
          <p>A queue session will be automatically created when the first patient checks in.</p>
        </div>
      )}

      {/* Dashboard */}
      {dashboard && (
        <>
          {/* Stats Row */}
          <div className="stats-grid">
            <div className="stat-card stat-current">
              <span className="stat-label">Current Token</span>
              <span className="stat-value">#{dashboard.session.current_token || '—'}</span>
            </div>
            <div className="stat-card stat-next">
              <span className="stat-label">Next Token</span>
              <span className="stat-value">
                #{(dashboard.session.current_token || 0) + 1 <= dashboard.session.total_tokens
                  ? (dashboard.session.current_token || 0) + 1
                  : '—'}
              </span>
            </div>
            <div className="stat-card stat-waiting">
              <span className="stat-label">Waiting</span>
              <span className="stat-value">{dashboard.waitingCount}</span>
            </div>
            <div className="stat-card stat-completed">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{dashboard.completedCount}</span>
            </div>
            <div className="stat-card stat-total">
              <span className="stat-label">Total</span>
              <span className="stat-value">{dashboard.totalCount}</span>
            </div>
            <div className={`stat-card stat-status queue-${dashboard.session.status}`}>
              <span className="stat-label">Queue Status</span>
              <span className="stat-value capitalize">{dashboard.session.status}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              onClick={() => performAction('next')}
              disabled={actionLoading !== null || dashboard.session.status !== 'open'}
              className="btn btn-primary btn-action"
            >
              {actionLoading === 'next' ? <span className="spinner-sm" /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              )}
              Next Patient
            </button>

            {dashboard.session.status === 'open' ? (
              <button
                onClick={() => performAction('pause')}
                disabled={actionLoading !== null}
                className="btn btn-warning btn-action"
              >
                {actionLoading === 'pause' ? <span className="spinner-sm" /> : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                )}
                Pause Queue
              </button>
            ) : dashboard.session.status === 'paused' ? (
              <button
                onClick={() => performAction('resume')}
                disabled={actionLoading !== null}
                className="btn btn-success btn-action"
              >
                {actionLoading === 'resume' ? <span className="spinner-sm" /> : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
                Resume Queue
              </button>
            ) : null}

            <button
              onClick={() => performAction('skip')}
              disabled={actionLoading !== null || dashboard.session.status !== 'open'}
              className="btn btn-secondary btn-action"
            >
              {actionLoading === 'skip' ? <span className="spinner-sm" /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <polygon points="13 4 23 12 13 20 13 4" />
                </svg>
              )}
              Skip
            </button>

            <button
              onClick={() => performAction('recall')}
              disabled={actionLoading !== null}
              className="btn btn-secondary btn-action"
            >
              {actionLoading === 'recall' ? <span className="spinner-sm" /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              )}
              Recall
            </button>

            <button
              onClick={() => setShowPriorityForm(!showPriorityForm)}
              disabled={actionLoading !== null}
              className="btn btn-accent btn-action"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Priority
            </button>

            <button
              onClick={() => {
                if (confirm('Are you sure you want to reset the queue? This will cancel all waiting patients.')) {
                  performAction('reset');
                }
              }}
              disabled={actionLoading !== null}
              className="btn btn-danger btn-action"
            >
              {actionLoading === 'reset' ? <span className="spinner-sm" /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              )}
              Reset
            </button>
          </div>

          {/* Priority Patient Form */}
          {showPriorityForm && (
            <form onSubmit={handlePrioritySubmit} className="priority-form glass-card">
              <h4>Add Priority Patient</h4>
              <div className="priority-fields">
                <input
                  type="text"
                  placeholder="Patient Name"
                  value={priorityName}
                  onChange={(e) => setPriorityName(e.target.value)}
                  className="form-input"
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone (10 digits)"
                  value={priorityPhone}
                  onChange={(e) => setPriorityPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                  className="form-input"
                  required
                  inputMode="numeric"
                />
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={actionLoading === 'priority'}
                >
                  {actionLoading === 'priority' ? <span className="spinner-sm" /> : 'Add'}
                </button>
              </div>
            </form>
          )}

          {/* Queue List */}
          <div className="queue-list-section">
            <h3 className="section-title">Patient Queue</h3>
            {dashboard.entries.length === 0 ? (
              <p className="empty-queue">No patients in queue yet.</p>
            ) : (
              <div className="queue-table-wrapper">
                <table className="queue-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Patient</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Time</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`queue-row ${entry.status === 'called' ? 'row-active' : ''} ${entry.priority ? 'row-priority' : ''}`}
                      >
                        <td className="token-cell">#{entry.token_number}</td>
                        <td>{entry.patient.name}</td>
                        <td className="phone-cell">{entry.patient.phone}</td>
                        <td>
                          <span className={`badge ${getStatusColor(entry.status)}`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="time-cell">
                          {new Date(entry.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td>
                          {entry.priority && (
                            <span className="badge badge-priority">⭐ Priority</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
