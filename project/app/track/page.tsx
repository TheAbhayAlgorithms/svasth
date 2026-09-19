'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import QueueStatus from '@/components/QueueStatus';
import Link from 'next/link';

function TrackingContent() {
  const searchParams = useSearchParams();
  const trackingId = searchParams.get('id');

  if (!trackingId) {
    return (
      <div className="page-container">
        <div className="error-page">
          <div className="error-icon-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="56" height="56">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1>Invalid Tracking Link</h1>
          <p>No tracking ID found. Please use the link from your registration confirmation.</p>
          <Link href="/" className="btn btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container tracking-page">
      <div className="tracking-wrapper">
        {/* Header */}
        <div className="tracking-header">
          <Link href="/" className="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div className="tracking-header-text">
            <h1>Queue Tracker</h1>
            <p>Live updates for your OPD visit</p>
          </div>
        </div>

        {/* Queue Status */}
        <QueueStatus trackingToken={trackingId} />
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="page-container">
          <div className="queue-status-loading">
            <div className="pulse-ring" />
            <p>Loading your queue status...</p>
          </div>
        </div>
      }
    >
      <TrackingContent />
    </Suspense>
  );
}
