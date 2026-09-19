# SVASTH Queue — QR-Based Digital OPD Queue Management

> **Skip the chaos. Track your OPD queue in real-time.**

A production-ready, hackathon-grade web platform for hospital OPD queue management. Patients scan a QR code, register with name & phone number, receive a token, and track their queue position in real-time via browser. Staff can manage the queue through a dedicated dashboard.

## 🚀 Features

- **QR Check-In**: Patients scan a QR code to join the queue — no app download needed
- **Real-Time Tracking**: Live queue position updates via Supabase Realtime
- **WhatsApp/SMS Notifications**: Automated alerts when the patient's turn approaches (mocked for prototype)
- **Staff Dashboard**: Full queue management — next, skip, recall, pause, reset, priority patients
- **Atomic Token Generation**: PostgreSQL function ensures no duplicate tokens
- **Mobile-First**: Responsive design optimized for scanning on phones

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime |
| Auth | Supabase Auth (staff only) |
| SMS | Twilio (mockable) |
| WhatsApp | Meta Cloud API (mockable) |
| Deployment | Vercel |

## 📋 Setup Instructions

### Prerequisites

- Node.js 18+
- npm
- A [Supabase](https://supabase.com) project

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd project
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run:
   - `database/schema.sql` — Creates all tables, RLS policies, and functions
   - `database/seed.sql` — Inserts sample hospital and doctors
3. Go to **Settings > API** and copy your:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Fill in your Supabase credentials in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Enable Realtime

In Supabase Dashboard:
1. Go to **Database > Replication**
2. Enable realtime for `queue_sessions` and `queue_entries` tables

### 5. Create Staff User

1. In Supabase Dashboard, go to **Authentication > Users**
2. Click "Add User" and create an account (e.g., `admin@svasth.com`)
3. In SQL Editor, insert the staff record:

```sql
INSERT INTO staff_users (auth_user_id, email, name, role, hospital_id)
VALUES (
  '<auth-user-uuid-from-step-2>',
  'admin@svasth.com',
  'Admin',
  'admin',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
);
```

### 6. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
project/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Design system
│   ├── check-in/[doctorId]/        # QR check-in page
│   ├── track/                      # Patient tracking page
│   ├── staff/login/                # Staff login
│   ├── staff/dashboard/            # Staff dashboard
│   └── api/
│       ├── queue/                  # Queue management APIs
│       ├── notifications/          # Notification dispatch
│       ├── webhooks/               # Provider webhooks
│       └── doctors/                # Doctor listing
├── components/
│   ├── CheckInForm.tsx             # Patient check-in form
│   ├── QueueStatus.tsx             # Real-time tracking display
│   ├── StaffControls.tsx           # Staff dashboard controls
│   └── QRCodeDisplay.tsx           # QR code generator
├── lib/
│   ├── supabase-server.ts          # Server-side Supabase client
│   ├── supabase-browser.ts         # Browser-side Supabase client
│   ├── validation.ts               # Zod schemas
│   ├── notifications.ts            # Notification service
│   └── queue.ts                    # Queue business logic
├── types/
│   └── database.ts                 # TypeScript types
├── database/
│   ├── schema.sql                  # Full database schema
│   └── seed.sql                    # Sample data
└── .env.local.example              # Environment template
```

## 🔗 Key URLs

| URL | Purpose |
|-----|---------|
| `/` | Landing page |
| `/check-in/{doctorId}` | Patient QR check-in |
| `/track?id={trackingToken}` | Patient queue tracking |
| `/staff/login` | Staff authentication |
| `/staff/dashboard` | Staff queue management |

## 🚢 Deploy to Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings
4. Deploy!

## 📝 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/queue/join` | Register patient, generate token |
| GET | `/api/queue/status?id={token}` | Get patient queue status |
| POST | `/api/queue/next` | Advance queue (staff) |
| POST | `/api/queue/skip` | Skip patient (staff) |
| POST | `/api/queue/recall` | Recall patient (staff) |
| POST | `/api/queue/pause` | Pause queue (staff) |
| POST | `/api/queue/resume` | Resume queue (staff) |
| POST | `/api/queue/reset` | Reset daily queue (staff) |
| POST | `/api/queue/priority` | Add priority patient (staff) |
| GET | `/api/doctors` | List active doctors |

## 🔒 Security

- Supabase Auth for staff routes
- Row Level Security (RLS) on all tables
- Service role key never exposed to frontend
- Random tracking tokens (nanoid)
- Zod validation on all inputs
- Consent checkbox for notifications
- No medical data in notifications

## 📱 Notification Templates

### Registration
```
Hello {name}, you are registered for {doctor}.
Your token is #{token}.
Current token: #{current}.
Track live queue: {url}
```

### Approaching (2 tokens away)
```
Hello {name}, your token #{token} is approaching.
Current token: #{current}.
Please reach Dr. {doctor}'s Room {room} soon.
```

### Called (your turn)
```
{name}, your token #{token} is now being called.
Please proceed to Dr. {doctor}'s Room {room}.
```

## License

MIT
