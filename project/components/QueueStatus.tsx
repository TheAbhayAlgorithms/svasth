'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

// ===========================================
// QueueStatus Component
// Real-time patient tracking display
// ===========================================

interface QueueStatusData {
  tokenNumber: number;
  currentToken: number;
  patientsAhead: number;
  estimatedWaitMinutes: number;
  status: string;
  doctorName: string;
  roomNumber: string;
  department: string;
  queueStatus: string;
  lastUpdated: string;
  trackingToken: string;
  sessionId: string;
}

interface QueueStatusProps {
  trackingToken: string;
}

export default function QueueStatus({ trackingToken }: QueueStatusProps) {
  const [data, setData] = useState<QueueStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/queue/status?id=${trackingToken}`);
      const result = await response.json();

      if (result.success) {
        setData(result);
        setError(null);
      } else {
        setError(result.error || 'Failed to load queue status');
      }
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [trackingToken]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Real-time subscription & fallback polling
  useEffect(() => {
    // 3-second polling interval as fallback
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    if (!data?.sessionId) {
      return () => clearInterval(interval);
    }

    let channel: RealtimeChannel | null = null;
    let supabase: SupabaseClient | null = null;

    try {
      supabase = getSupabaseBrowserClient();
      channel = supabase
        .channel(`queue-${data.sessionId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'queue_sessions',
            filter: `id=eq.${data.sessionId}`,
          },
          () => {
            fetchStatus();
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
  }, [data?.sessionId, fetchStatus]);

  if (loading) {
    return (
      <div className="queue-status-loading">
        <div className="pulse-ring" />
        <p>Loading your queue status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="queue-status-error">
        <div className="error-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h3>Unable to Load Status</h3>
        <p>{error}</p>
        <button onClick={fetchStatus} className="btn btn-secondary">
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const isApproaching = data.status === 'waiting' && data.patientsAhead <= 2 && data.patientsAhead > 0;
  const isCalled = data.status === 'called' || data.tokenNumber === data.currentToken;
  const isCompleted = data.status === 'completed';
  const isSkipped = data.status === 'skipped';

  const getStatusClass = () => {
    if (isCalled) return 'status-called';
    if (isApproaching) return 'status-approaching';
    if (isCompleted) return 'status-completed';
    if (isSkipped) return 'status-skipped';
    return 'status-waiting';
  };

  const getStatusLabel = () => {
    if (isCalled) return 'Your Turn Now!';
    if (isApproaching) return 'Almost There!';
    if (isCompleted) return 'Consultation Complete';
    if (isSkipped) return 'Skipped';
    return 'Waiting';
  };

  return (
    <div className={`queue-status ${getStatusClass()}`}>
      {/* Alert Banner */}
      {isCalled && (
        <div className="alert-banner alert-called">
          <div className="alert-pulse" />
          <div className="alert-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <div>
              <strong>Your token is being called!</strong>
              <p>Please proceed to {data.doctorName}&apos;s Room {data.roomNumber}</p>
            </div>
          </div>
        </div>
      )}

      {isApproaching && (
        <div className="alert-banner alert-approaching">
          <div className="alert-content">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <strong>Your token is approaching!</strong>
              <p>Please reach Room {data.roomNumber} soon</p>
            </div>
          </div>
        </div>
      )}

      {/* Token Display */}
      <div className="token-hero">
        <span className="token-hero-label">Your Token</span>
        <span className="token-hero-number">#{data.tokenNumber}</span>
        <span className={`status-badge ${getStatusClass()}`}>{getStatusLabel()}</span>
      </div>

      {/* Progress Cards */}
      <div className="progress-grid">
        <div className="progress-card current-token-card">
          <div className="progress-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span className="progress-card-value">#{data.currentToken || '—'}</span>
          <span className="progress-card-label">Now Serving</span>
        </div>

        <div className="progress-card ahead-card">
          <div className="progress-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <span className="progress-card-value">{data.patientsAhead}</span>
          <span className="progress-card-label">Ahead of You</span>
        </div>

        <div className="progress-card wait-card">
          <div className="progress-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <span className="progress-card-value">~{data.estimatedWaitMinutes} min</span>
          <span className="progress-card-label">Est. Wait</span>
        </div>
      </div>

      {/* Doctor Info */}
      <div className="doctor-info-card">
        <div className="doctor-info-row">
          <span className="doctor-info-label">Doctor</span>
          <span className="doctor-info-value">{data.doctorName}</span>
        </div>
        <div className="doctor-info-row">
          <span className="doctor-info-label">Department</span>
          <span className="doctor-info-value">{data.department}</span>
        </div>
        <div className="doctor-info-row">
          <span className="doctor-info-label">Room</span>
          <span className="doctor-info-value">{data.roomNumber}</span>
        </div>
        <div className="doctor-info-row">
          <span className="doctor-info-label">Queue Status</span>
          <span className={`queue-status-badge queue-${data.queueStatus}`}>
            {data.queueStatus.charAt(0).toUpperCase() + data.queueStatus.slice(1)}
          </span>
        </div>
      </div>

      {/* Live indicator */}
      <div className="live-indicator">
        <span className="live-dot" />
        <span>Live updates active</span>
        <span className="last-updated">
          Updated {new Date(data.lastUpdated).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
