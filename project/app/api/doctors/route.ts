// ===========================================
// GET /api/doctors — List Active Doctors
// ===========================================

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { mockStore } from '@/lib/mock-store';

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data: doctors, error } = await supabase
      .from('doctors')
      .select('*, hospital:hospitals!inner(name)')
      .eq('is_active', true)
      .order('department', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.warn('Supabase error, falling back to mock store:', error.message);
      return NextResponse.json({ success: true, doctors: mockStore.getDoctors() });
    }

    // Also get today's sessions for each doctor
    const today = new Date().toISOString().split('T')[0];
    const { data: sessions } = await supabase
      .from('queue_sessions')
      .select('*')
      .eq('session_date', today);

    const doctorsWithSessions = (doctors || []).map((doctor) => {
      const session = (sessions || []).find(
        (s) => (s as { doctor_id: string }).doctor_id === doctor.id
      );
      return {
        ...doctor,
        todaySession: session || null,
      };
    });

    return NextResponse.json({ success: true, doctors: doctorsWithSessions });
  } catch (error) {
    console.warn('Doctors list fetch error, using mock store fallback:', error);
    return NextResponse.json({ success: true, doctors: mockStore.getDoctors() });
  }
}
