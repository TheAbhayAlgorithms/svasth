import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'SVASTH Queue — Smart Hospital OPD Queue',
  description:
    'Skip the chaos. Scan a QR code, get your token, and track your OPD queue position in real-time. No more waiting in crowded lobbies.',
};

export default function HomePage() {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-brand">
            <div className="nav-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span className="nav-title">SVASTH Queue</span>
          </div>
          <div className="nav-links">
            <Link href="/staff/login" className="btn btn-ghost btn-sm">
              Staff Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-gradient-1" />
          <div className="hero-gradient-2" />
          <div className="hero-grid-pattern" />
        </div>

        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Digital OPD Queue Management
          </div>

          <h1 className="hero-title">
            Skip the Chaos.
            <br />
            <span className="hero-title-accent">Track Your Turn</span>
            <br />
            in Real-Time.
          </h1>

          <p className="hero-subtitle">
            Scan a QR code, get your token instantly, and track your queue position
            live from your phone. No more crowded waiting rooms.
          </p>

          <div className="hero-actions">
            <a href="#patient-checkin" className="btn btn-primary btn-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
              Patient Check-In (OTP)
            </a>
            <Link href="/staff/login" className="btn btn-glass btn-lg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Staff Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Patient Check-in OPD Doctors */}
      <section id="patient-checkin" className="patient-checkin-section">
        <div className="section-container">
          <div className="section-header-badge">
            <span className="badge-shield">🔒 100% Passwordless</span>
            <h2 className="section-title-center">Patient OPD Check-In</h2>
            <p className="section-subtitle">
              Scan a doctor&apos;s QR code or select below. Authenticate instantly via <strong>6-digit Mobile OTP</strong> — no email or password needed!
            </p>
          </div>

          <div className="doctor-cards-grid">
            <div className="doctor-checkin-card">
              <div className="doc-avatar-circle">🩺</div>
              <h3>Dr. Priya Sharma</h3>
              <p className="doc-dept-badge">General Medicine · Room 101</p>
              <p className="doc-note">Internal Medicine &amp; General OPD</p>
              <Link
                href="/check-in/d1000001-0000-0000-0000-000000000001"
                className="btn btn-primary btn-sm btn-full"
              >
                Scan / Check-in via OTP
              </Link>
            </div>

            <div className="doctor-checkin-card">
              <div className="doc-avatar-circle">🦴</div>
              <h3>Dr. Rajesh Patel</h3>
              <p className="doc-dept-badge">Orthopedics · Room 205</p>
              <p className="doc-note">Joint, Spine &amp; Bone Specialist</p>
              <Link
                href="/check-in/d1000001-0000-0000-0000-000000000002"
                className="btn btn-primary btn-sm btn-full"
              >
                Scan / Check-in via OTP
              </Link>
            </div>

            <div className="doctor-checkin-card">
              <div className="doc-avatar-circle">👶</div>
              <h3>Dr. Ananya Gupta</h3>
              <p className="doc-dept-badge">Pediatrics · Room 310</p>
              <p className="doc-note">Child Healthcare &amp; Vaccinations</p>
              <Link
                href="/check-in/d1000001-0000-0000-0000-000000000003"
                className="btn btn-primary btn-sm btn-full"
              >
                Scan / Check-in via OTP
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-it-works">
        <div className="section-container">
          <h2 className="section-title-center">How Patient Check-In Works</h2>
          <p className="section-subtitle">Three simple steps to a secure, stress-free hospital visit</p>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                </svg>
              </div>
              <h3>Scan Doctor QR</h3>
              <p>Scan the QR code displayed at the doctor&apos;s counter or reception desk with your phone camera.</p>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <h3>Verify with 6-Digit OTP</h3>
              <p>Enter your mobile number, receive a 6-digit OTP code, and enter it to authenticate. No invalid numbers allowed.</p>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <div className="step-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h3>Instant Token &amp; Live Tracking</h3>
              <p>Your verified OPD token is generated instantly. Track your queue live without waiting in crowded rooms.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="section-container">
          <h2 className="section-title-center">Why SVASTH Queue?</h2>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon feature-icon-realtime">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h4>Real-Time Updates</h4>
              <p>Live queue position tracking with instant notifications</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon-whatsapp">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h4>WhatsApp Alerts</h4>
              <p>Get notified on WhatsApp when your token is approaching</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon-secure">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h4>Privacy First</h4>
              <p>Minimal data collection. No medical info stored or shared.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon feature-icon-easy">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              </div>
              <h4>No App Needed</h4>
              <p>Works in any mobile browser. Just scan and go.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span>SVASTH Queue</span>
          </div>
          <p className="footer-text">
            Built for better healthcare experiences.
          </p>
        </div>
      </footer>
    </div>
  );
}
