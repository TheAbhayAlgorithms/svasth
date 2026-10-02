'use client';

import React, { useState, useRef, useEffect } from 'react';

// ===========================================
// CheckInForm Component
// Secure QR check-in with 6-digit Mobile OTP Authentication
// No email or password needed for patients.
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
  otp?: string;
  general?: string;
}

export default function CheckInForm({
  doctorId,
  doctorName,
  department,
  roomNumber,
}: CheckInFormProps) {
  // Step state: 'details' | 'otp'
  const [step, setStep] = useState<'details' | 'otp'>('details');

  // Input states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(true); // default true for frictionless patient check-in

  // OTP states (6 individual digits)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // Status states
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState<CheckInSuccess | null>(null);

  // References for OTP input focus management
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Validate step 1 fields
  const validateDetails = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim() || name.trim().length < 2) {
      newErrors.name = 'Please enter your full name (at least 2 characters)';
    }

    const phoneDigits = phone.replace(/[\s\-\(\)\+]/g, '');
    const phoneRegex = /^(?:91)?[6-9]\d{9}$/;
    if (!phoneRegex.test(phoneDigits)) {
      newErrors.phone = 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210)';
    }

    if (!consent) {
      newErrors.consent = 'You must agree to receive queue notifications';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step 1: Send 6-digit OTP
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateDetails()) return;

    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          doctorId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setStep('otp');
        setCooldown(30);
        if (data.debugOtp) {
          setDemoOtp(data.debugOtp);
        }
        setOtpDigits(['', '', '', '', '', '']);
      } else {
        setErrors({ general: data.error || 'Failed to send OTP. Please try again.' });
      }
    } catch {
      setErrors({ general: 'Network error. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          doctorId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCooldown(30);
        if (data.debugOtp) {
          setDemoOtp(data.debugOtp);
        }
        setOtpDigits(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      } else {
        setErrors({ general: data.error || 'Failed to resend OTP.' });
      }
    } catch {
      setErrors({ general: 'Network error while resending OTP.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle single or multi-digit OTP input
  const handleOtpChange = (index: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, '');

    // Handle paste of full or partial code
    if (digitsOnly.length > 1) {
      const newDigits = [...otpDigits];
      const pasted = digitsOnly.slice(0, 6).split('');
      pasted.forEach((d, i) => {
        if (index + i < 6) {
          newDigits[index + i] = d;
        }
      });
      setOtpDigits(newDigits);

      const nextFocus = Math.min(index + pasted.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const newDigits = [...otpDigits];
    newDigits[index] = digitsOnly;
    setOtpDigits(newDigits);
    setErrors((prev) => ({ ...prev, otp: undefined, general: undefined }));

    // Auto-advance to next box
    if (digitsOnly && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation in OTP boxes
  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Auto-fill demo OTP
  const handleAutofillDemoOtp = (code: string) => {
    const chars = code.slice(0, 6).split('');
    const newDigits = ['', '', '', '', '', ''];
    chars.forEach((c, i) => {
      newDigits[i] = c;
    });
    setOtpDigits(newDigits);
    otpInputRefs.current[5]?.focus();
  };

  // Step 2: Verify OTP and Join Queue (Generate Token)
  const handleVerifyAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');

    if (fullOtp.length !== 6) {
      setErrors({ otp: 'Please enter all 6 digits of the OTP' });
      return;
    }

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
          otp: fullOtp,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(data);
      } else {
        setErrors({
          otp: data.error || 'Invalid OTP code. Please check and try again.',
          general: data.error,
        });
      }
    } catch {
      setErrors({ general: 'Network error. Please check your connection.' });
    } finally {
      setLoading(false);
    }
  };

  // ===========================================
  // Step 3: SUCCESS VIEW
  // ===========================================
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

        <div className="auth-verified-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Mobile Number Verified via 6-Digit OTP
        </div>

        <h2 className="success-title">You&apos;re Registered!</h2>
        <p className="success-subtitle">
          Hello <strong>{success.patientName}</strong>, your token has been safely generated for{' '}
          <strong>{success.doctorName}</strong>
        </p>

        <div className="token-display">
          <span className="token-label">Your OPD Token</span>
          <span className="token-number">#{success.tokenNumber}</span>
        </div>

        <div className="status-cards">
          <div className="status-card">
            <span className="status-card-label">Current Serving</span>
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
          Track Live Queue on Phone
        </a>

        <p className="notification-note">
          📱 SMS / WhatsApp alerts will be delivered to <strong>+91 {phone.slice(-10)}</strong> as your turn approaches.
        </p>
      </div>
    );
  }

  // ===========================================
  // Step 2: ENTER 6-DIGIT OTP VIEW
  // ===========================================
  if (step === 'otp') {
    return (
      <form onSubmit={handleVerifyAndJoin} className="check-in-form otp-step-form" noValidate>
        {/* Doctor Summary Banner */}
        <div className="doctor-info-banner">
          <div className="doctor-avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h3 className="doctor-name">{doctorName}</h3>
            <p className="doctor-dept">{department} · Room {roomNumber}</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="auth-step-indicator">
          <span className="step-pill step-done">✓ 1. Patient Info</span>
          <span className="step-arrow">→</span>
          <span className="step-pill step-active">2. 6-Digit OTP</span>
        </div>

        {/* Heading & Mobile Display */}
        <div className="otp-heading-box">
          <div className="otp-shield-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2 className="otp-title">Enter Verification Code</h2>
          <p className="otp-desc">
            We sent a 6-digit OTP to{' '}
            <strong className="otp-target-phone">+91 {phone.slice(-10)}</strong>
          </p>
          <button
            type="button"
            className="otp-edit-phone-btn"
            onClick={() => {
              setStep('details');
              setErrors({});
            }}
          >
            ✏️ Change mobile number
          </button>
        </div>

        {/* Errors */}
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

        {/* Demo OTP Helper Pill (For instant testing/evaluation) */}
        {demoOtp && (
          <div
            className="demo-otp-banner"
            onClick={() => handleAutofillDemoOtp(demoOtp)}
            title="Click to auto-fill OTP"
            role="button"
            tabIndex={0}
          >
            <span className="demo-otp-badge">Prototype Demo</span>
            <span className="demo-otp-text">
              Generated Code: <strong>{demoOtp}</strong> (Tap to Auto-fill)
            </span>
          </div>
        )}

        {/* 6-Digit OTP Input Boxes */}
        <div className="otp-inputs-wrapper">
          <div className="otp-inputs-row">
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  otpInputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                disabled={loading}
                className={`otp-digit-box ${digit ? 'filled' : ''} ${errors.otp ? 'error' : ''}`}
                autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                aria-label={`Digit ${idx + 1}`}
              />
            ))}
          </div>
          {errors.otp && <p className="otp-error-text">{errors.otp}</p>}
        </div>

        {/* Resend OTP Section */}
        <div className="otp-resend-row">
          {cooldown > 0 ? (
            <span className="otp-cooldown-text">
              Resend OTP in <strong>{cooldown}s</strong>
            </span>
          ) : (
            <button
              type="button"
              className="otp-resend-btn"
              onClick={handleResendOtp}
              disabled={loading}
            >
              🔄 Resend 6-Digit OTP
            </button>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary btn-lg btn-full"
          disabled={loading || otpDigits.join('').length !== 6}
        >
          {loading ? (
            <>
              <span className="spinner" />
              Verifying &amp; Generating Token...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              Verify OTP &amp; Generate Token
            </>
          )}
        </button>

        <p className="otp-security-footer">
          🔒 Only verified mobile numbers receive an OPD token. No credentials or login required.
        </p>
      </form>
    );
  }

  // ===========================================
  // Step 1: PATIENT REGISTRATION FORM VIEW
  // ===========================================
  return (
    <form onSubmit={handleSendOtp} className="check-in-form" noValidate>
      {/* Doctor Summary Banner */}
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

      {/* Patient Auth Banner */}
      <div className="patient-auth-notice">
        <div className="auth-notice-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <div className="auth-notice-content">
          <strong>Instant Mobile Check-In</strong>
          <span>No email or password required. Authenticate securely with a 6-digit mobile OTP.</span>
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

      {/* Patient Name */}
      <div className="form-group">
        <label htmlFor="patient-name" className="form-label">
          Full Name
        </label>
        <input
          id="patient-name"
          type="text"
          className={`form-input ${errors.name ? 'form-input-error' : ''}`}
          placeholder="e.g. Ramesh Kumar"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          autoComplete="name"
          maxLength={100}
        />
        {errors.name && <span className="form-error">{errors.name}</span>}
      </div>

      {/* Patient Mobile Number */}
      <div className="form-group">
        <label htmlFor="patient-phone" className="form-label">
          Mobile Number <span className="label-badge">OTP will be sent here</span>
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
        <span className="form-hint">Enter your 10-digit mobile number to receive your 6-digit OTP code</span>
        {errors.phone && <span className="form-error">{errors.phone}</span>}
      </div>

      {/* Consent Checkbox */}
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
            I agree to receive queue status alerts and token updates via WhatsApp/SMS
          </span>
        </label>
        {errors.consent && <span className="form-error">{errors.consent}</span>}
      </div>

      {/* Send OTP Button */}
      <button
        type="submit"
        className="btn btn-primary btn-lg btn-full"
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" />
            Sending 6-Digit OTP...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            Send 6-Digit OTP &amp; Proceed
          </>
        )}
      </button>

      <div className="checkin-security-note">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>Validates that you own this number before issuing your queue token.</span>
      </div>
    </form>
  );
}
