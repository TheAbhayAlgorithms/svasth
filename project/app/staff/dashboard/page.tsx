'use client';

import React, { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { useRouter } from 'next/navigation';
import StaffControls from '@/components/StaffControls';
import Link from 'next/link';

export default function StaffDashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setAuthenticated(true);
          setUserName(session.user.email || 'Staff');
          setLoading(false);
          return;
        }
      } catch {
        // Ignore Supabase error and check mock session
      }

      const mockSession = localStorage.getItem('svasth_mock_staff');
      if (mockSession) {
        try {
          const parsed = JSON.parse(mockSession);
          setAuthenticated(true);
          setUserName(parsed.email || 'Staff');
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

  if (loading) {
    return (
      <div className="page-container">
        <div className="queue-status-loading">
          <div className="pulse-ring" />
          <p>Verifying authentication...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div className="page-container dashboard-page">
      {/* Dashboard Nav */}
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
            <span className="nav-subtitle">Staff Dashboard</span>
          </div>
          <div className="nav-right">
            <span className="nav-user">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              {userName}
            </span>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div className="dashboard-content">
        <StaffControls />
      </div>
    </div>
  );
}
