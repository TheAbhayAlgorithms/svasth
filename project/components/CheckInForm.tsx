'use client';

import React, { useState } from 'react';

// ===========================================
// CheckInForm Component
// Beautiful form for patient QR check-in
// ===========================================

interface CheckInFormProps {
  doctorId: string;
  doctorName: string;
  department: string;
  roomNumber: string;
}

interface CheckInSuccess {
  tokenNumber: number;
  currentToken: number;
  doctorName: string;
  trackingToken: string;
  trackingUrl: string;
  patientName: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  consent?: string;
  general?: string;
}

export default function CheckInForm({
  doctorId,
  doctorName,
  department,
  roomNumber,
}: CheckInFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<CheckInSuccess | null>(null);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Please enter your full name (at least 2 characters)';
    }

    const phoneDigits = phone.replace(/[\s\-\(\)\+]/g, '');
    const phoneRegex = /^(?:91)?[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneDigits)) {
      newErrors.phone = 'Please enter a valid Indian mobile number';
    }

    if (!consent) {
      newErrors.consent = 'You must agree to receive queue notifications';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId,
          name: name.trim(),
          phone: phone.trim(),
          consent,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data);
      } else {
        setErrors({ general: data.error || 'Failed to register. Please try again.' });
      }
    } catch {
      setErrors({ general: 'Network error. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  // Success view
  if (success) {
    return (
      <div className="check-in-success">
        <div className="success-icon-wrapper">
          <div className="success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h2 className="success-title">You&apos;re Registered!</h2>
        <p className="success-subtitle">
          Hello <strong>{success.patientName}</strong>, you are registered for{' '}
          <strong>{success.doctorName}</strong>
        </p>

        <div className="token-display">
          <span className="token-label">Your Token</span>
          <span className="token-number">#{success.tokenNumber}</span>
        </div>

        <div className="status-cards">
          <div className="status-card">
            <span className="status-card-label">Current Token</span>
            <span className="status-card-value">#{success.currentToken || '—'}</span>
          </div>
          <div className="status-card">
            <span className="status-card-label">Room</span>
            <span className="status-card-value">{roomNumber}</span>
          </div>
          <div className="status-card">
            <span className="status-card-label">Department</span>
            <span className="status-card-value">{department}</span>
          </div>
        </div>

        <a href={`/track?id=${success.trackingToken}`} className="btn btn-primary btn-lg tracking-link">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Track Your Queue Live
        </a>

        <p className="notification-note">
          📱 You will receive WhatsApp/SMS notifications when your turn approaches.
        </p>
      </div>
    );
  }

  // Form view
  return (
    <form onSubmit={handleSubmit} className="check-in-form" noValidate>
      <div className="doctor-info-banner">
        <div className="doctor-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h3 className="doctor-name">{doctorName}</h3>
          <p className="doctor-dept">{department} · Room {roomNumber}</p>
        </div>
      </div>

      {errors.general && (
        <div className="form-error-banner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {errors.general}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="patient-name" className="form-label">
          Full Name
        </label>
        <input
          id="patient-name"
          type="text"
          className={`form-input ${errors.name ? 'form-input-error' : ''}`}
          placeholder="Enter your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoComplete="name"
          maxLength={100}
        />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="patient-phone" className="form-label">
          Phone Number
        </label>
        <div className="phone-input-wrapper">
          <span className="phone-prefix">+91</span>
          <input
            id="patient-phone"
            type="tel"
            className={`form-input phone-input ${errors.phone ? 'form-input-error' : ''}`}
            placeholder="9876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
            disabled={loading}
            autoComplete="tel"
            maxLength={10}
            inputMode="numeric"
          />
        </div>
        {errors.phone && <span className="form-error">{errors.phone}</span>}
      </div>

      <div className="form-group">
        <label className={`consent-label ${errors.consent ? 'consent-error' : ''}`}>
          <input
            type="checkbox"
            className="consent-checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={loading}
          />
          <span className="consent-checkmark" />
          <span className="consent-text">
            I agree to receive queue notifications via WhatsApp/SMS
          </span>
        </label>
        {errors.consent && <span className="form-error">{errors.consent}</span>}
      </div>

      <button
        type="submit"
        className="btn btn-primary btn-lg btn-full"
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" />
            Generating Token...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Generate Token
          </>
        )}
      </button>
    </form>
  );
}
