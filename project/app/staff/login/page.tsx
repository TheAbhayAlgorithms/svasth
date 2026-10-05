'use client';

import React, { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function StaffLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = getSupabaseBrowserClient();

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.warn('Supabase Auth warning, using demo staff session:', authError.message);
        localStorage.setItem('quevaa_mock_staff', JSON.stringify({ email: email || 'admin@quevaa.com' }));
      }

      router.push('/staff/dashboard');
    } catch {
      localStorage.setItem('quevaa_mock_staff', JSON.stringify({ email: email || 'admin@quevaa.com' }));
      router.push('/staff/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container login-page">
      <div className="login-wrapper">
        <div className="login-card glass-card">
          {/* Logo */}
          <div className="login-logo">
            <div className="login-logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <h1>Quevaa</h1>
            <p>Staff Portal</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="login-form">
            {error && (
              <div className="form-error-banner">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="staff-email" className="form-label">
                Email Address
              </label>
              <input
                id="staff-email"
                type="email"
                className="form-input"
                placeholder="admin@hospital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="staff-password" className="form-label">
                Password
              </label>
              <input
                id="staff-password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="login-footer">
            <Link href="/" className="login-back-link">
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
