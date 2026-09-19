import type { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase-server';
import CheckInForm from '@/components/CheckInForm';
import Link from 'next/link';

interface CheckInPageProps {
  params: Promise<{ doctorId: string }>;
}

export async function generateMetadata({ params }: CheckInPageProps): Promise<Metadata> {
  const { doctorId } = await params;
  const supabase = createServiceClient();
  const { data: doctor } = await supabase
    .from('doctors')
    .select('name, department')
    .eq('id', doctorId)
    .single();

  return {
    title: doctor
      ? `Check In — ${doctor.name} | SVASTH Queue`
      : 'Check In | SVASTH Queue',
    description: doctor
      ? `Register for ${doctor.name}'s OPD queue — ${doctor.department}`
      : 'Register for your OPD appointment',
  };
}

export default async function CheckInPage({ params }: CheckInPageProps) {
  const { doctorId } = await params;
  const supabase = createServiceClient();

  const { data: doctor, error } = await supabase
    .from('doctors')
    .select('*, hospital:hospitals!inner(name)')
    .eq('id', doctorId)
    .eq('is_active', true)
    .single();

  if (error || !doctor) {
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
          <h1>Doctor Not Found</h1>
          <p>This check-in link is invalid or the doctor is currently unavailable.</p>
          <Link href="/" className="btn btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const hospitalName = (doctor as unknown as { hospital: { name: string } }).hospital?.name || 'SVASTH Hospital';

  return (
    <div className="page-container checkin-page">
      <div className="checkin-wrapper">
        {/* Header */}
        <div className="checkin-header">
          <Link href="/" className="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div className="checkin-header-text">
            <p className="hospital-label">{hospitalName}</p>
            <h1>OPD Check-In</h1>
          </div>
        </div>

        {/* Check-in Form */}
        <CheckInForm
          doctorId={doctorId}
          doctorName={doctor.name}
          department={doctor.department || 'General'}
          roomNumber={doctor.room_number || 'N/A'}
        />
      </div>
    </div>
  );
}
