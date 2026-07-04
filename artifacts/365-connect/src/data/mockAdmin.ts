export type UserRole   = 'worker' | 'client' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'flagged';

export type AdminUser = {
  id: string;
  displayName: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  joinDate: string;
  shiftsCompleted: number;
  rating: number;       // 0 = N/A (clients)
  totalRevenue: number; // platform fees generated (client) or earned (worker)
  photoUrl: string;
  flagNote?: string;
};

export type ShiftStatus = 'open' | 'filled' | 'in-progress' | 'completed' | 'cancelled';

export type AdminShift = {
  id: string;
  jobType: string;
  companyName: string;
  clientId: string;
  date: string;
  payRate: number;
  workersNeeded: number;
  applicants: { id: string; name: string; photoUrl: string; matchPct: number }[];
  status: ShiftStatus;
  platformFee: number; // 8% of gross (rate × hours × workers, estimated)
};

export type DisputeStatus = 'open' | 'resolved' | 'warned' | 'banned';
export type DisputeType   = 'no-show' | 'late-cancel' | 'fake-review' | 'dress-code' | 'payment' | 'harassment';

export type AdminDispute = {
  id: string;
  type: DisputeType;
  reportedUserId: string;
  reportedUserName: string;
  reportedByName: string;
  reason: string;
  timestamp: string;
  status: DisputeStatus;
};

/* ── Users ───────────────────────────────────────────────────────────────── */
export const ADMIN_USERS: AdminUser[] = [
  { id: 'u-01', displayName: 'Marcus Brown',    username: 'marcus_b',         email: 'marcus@email.com',    role: 'worker', status: 'active',    joinDate: 'Jan 12, 2026', shiftsCompleted: 47, rating: 4.9, totalRevenue: 5840, photoUrl: 'https://i.pravatar.cc/150?img=12' },
  { id: 'u-02', displayName: 'Jade Rivera',     username: 'jade_r',           email: 'jade@email.com',      role: 'worker', status: 'active',    joinDate: 'Feb 3, 2026',  shiftsCompleted: 31, rating: 4.7, totalRevenue: 3620, photoUrl: 'https://i.pravatar.cc/150?img=47' },
  { id: 'u-03', displayName: 'Tyrone Williams', username: 'tyrone_w',          email: 'tyrone@email.com',    role: 'worker', status: 'active',    joinDate: 'Dec 18, 2025', shiftsCompleted: 28, rating: 4.8, totalRevenue: 3150, photoUrl: 'https://i.pravatar.cc/150?img=15' },
  { id: 'u-04', displayName: 'Sofia Martinez',  username: 'sofia_m',           email: 'sofia@email.com',     role: 'worker', status: 'active',    joinDate: 'Mar 7, 2026',  shiftsCompleted: 22, rating: 4.6, totalRevenue: 2240, photoUrl: 'https://i.pravatar.cc/150?img=44' },
  { id: 'u-05', displayName: 'Kevin Liu',       username: 'kevin_liu',         email: 'kevin@email.com',     role: 'worker', status: 'active',    joinDate: 'Mar 21, 2026', shiftsCompleted: 15, rating: 4.5, totalRevenue: 1680, photoUrl: 'https://i.pravatar.cc/150?img=33' },
  { id: 'u-06', displayName: 'Priya Patel',     username: 'priya_p',           email: 'priya@email.com',     role: 'worker', status: 'active',    joinDate: 'Feb 14, 2026', shiftsCompleted: 19, rating: 4.7, totalRevenue: 2110, photoUrl: 'https://i.pravatar.cc/150?img=53' },
  { id: 'u-07', displayName: 'Brandon Clark',   username: 'brandon_c',         email: 'brandon@email.com',   role: 'worker', status: 'active',    joinDate: 'Apr 2, 2026',  shiftsCompleted: 11, rating: 4.4, totalRevenue: 1140, photoUrl: 'https://i.pravatar.cc/150?img=60' },
  { id: 'u-08', displayName: 'Nicole Foster',   username: 'nicole_f',          email: 'nicole@email.com',    role: 'worker', status: 'active',    joinDate: 'Jan 28, 2026', shiftsCompleted: 34, rating: 4.9, totalRevenue: 4200, photoUrl: 'https://i.pravatar.cc/150?img=49' },
  { id: 'u-09', displayName: 'Aisha Johnson',   username: 'aisha_j',           email: 'aisha@email.com',     role: 'worker', status: 'flagged',   joinDate: 'May 5, 2026',  shiftsCompleted:  8, rating: 3.2, totalRevenue:  720, photoUrl: 'https://i.pravatar.cc/150?img=56', flagNote: '3 late cancellations within 30 days. Client complaints filed.' },
  { id: 'u-10', displayName: 'Derek Santos',    username: 'derek_s',           email: 'derek@email.com',     role: 'worker', status: 'suspended', joinDate: 'Apr 19, 2026', shiftsCompleted:  3, rating: 1.8, totalRevenue:  180, photoUrl: 'https://i.pravatar.cc/150?img=61', flagNote: 'Two confirmed no-shows. Suspended per Terms §4.2.' },
  { id: 'u-11', displayName: 'James Whitfield', username: 'rooftopbar_miami',  email: 'james@rooftopbar.com',role: 'client', status: 'active',    joinDate: 'Nov 10, 2025', shiftsCompleted:  0, rating: 0,   totalRevenue: 8420, photoUrl: 'https://i.pravatar.cc/150?img=68' },
  { id: 'u-12', displayName: 'Ricardo Vega',    username: 'liv_miami',         email: 'ricardo@liv.com',     role: 'client', status: 'active',    joinDate: 'Oct 5, 2025',  shiftsCompleted:  0, rating: 0,   totalRevenue: 12600, photoUrl: 'https://i.pravatar.cc/150?img=59' },
  { id: 'u-13', displayName: 'Amara Diaz',      username: 'fontainebleau',     email: 'amara@fbh.com',       role: 'client', status: 'active',    joinDate: 'Sep 22, 2025', shiftsCompleted:  0, rating: 0,   totalRevenue: 21800, photoUrl: 'https://i.pravatar.cc/150?img=36' },
  { id: 'u-14', displayName: 'Chris Eaton',     username: '1hotel_sb',         email: 'chris@1hotel.com',    role: 'client', status: 'active',    joinDate: 'Dec 1, 2025',  shiftsCompleted:  0, rating: 0,   totalRevenue: 9340, photoUrl: 'https://i.pravatar.cc/150?img=70' },
  { id: 'u-15', displayName: 'Admin User',      username: 'admin',             email: 'admin@365connect.com',role: 'admin',  status: 'active',    joinDate: 'Jan 1, 2025',  shiftsCompleted:  0, rating: 0,   totalRevenue:    0, photoUrl: 'https://i.pravatar.cc/150?img=8' },
];

/* ── Shifts ──────────────────────────────────────────────────────────────── */
export const ADMIN_SHIFTS: AdminShift[] = [
  { id: 's-01', jobType: 'VIP Host',         companyName: 'LIV Nightclub',      clientId: 'u-12', date: 'Jul 8, 2026',  payRate: 35, workersNeeded: 2, status: 'open',        platformFee: 56,  applicants: [{ id: 'u-01', name: 'Marcus Brown',    photoUrl: 'https://i.pravatar.cc/150?img=12', matchPct: 97 }, { id: 'u-02', name: 'Jade Rivera',    photoUrl: 'https://i.pravatar.cc/150?img=47', matchPct: 91 }, { id: 'u-08', name: 'Nicole Foster',   photoUrl: 'https://i.pravatar.cc/150?img=49', matchPct: 88 }] },
  { id: 's-02', jobType: 'VIP Server',       companyName: 'Fontainebleau Hotel', clientId: 'u-13', date: 'Jul 6, 2026',  payRate: 32, workersNeeded: 4, status: 'open',        platformFee: 102, applicants: [{ id: 'u-02', name: 'Jade Rivera',    photoUrl: 'https://i.pravatar.cc/150?img=47', matchPct: 96 }, { id: 'u-04', name: 'Sofia Martinez',  photoUrl: 'https://i.pravatar.cc/150?img=44', matchPct: 89 }] },
  { id: 's-03', jobType: 'Bartender',        companyName: 'The Rooftop Bar',    clientId: 'u-11', date: 'Jul 5, 2026',  payRate: 28, workersNeeded: 2, status: 'open',        platformFee: 45,  applicants: [{ id: 'u-03', name: 'Tyrone Williams', photoUrl: 'https://i.pravatar.cc/150?img=15', matchPct: 94 }] },
  { id: 's-04', jobType: 'Security',         companyName: 'LIV Nightclub',      clientId: 'u-12', date: 'Jul 6, 2026',  payRate: 26, workersNeeded: 5, status: 'filled',      platformFee: 124, applicants: [{ id: 'u-03', name: 'Tyrone Williams', photoUrl: 'https://i.pravatar.cc/150?img=15', matchPct: 99 }, { id: 'u-07', name: 'Brandon Clark',   photoUrl: 'https://i.pravatar.cc/150?img=60', matchPct: 85 }] },
  { id: 's-05', jobType: 'Bartender',        companyName: '1 Hotel South Beach', clientId: 'u-14', date: 'Jul 4, 2026',  payRate: 30, workersNeeded: 3, status: 'in-progress', platformFee: 86,  applicants: [{ id: 'u-01', name: 'Marcus Brown',    photoUrl: 'https://i.pravatar.cc/150?img=12', matchPct: 98 }] },
  { id: 's-06', jobType: 'Cocktail Server',  companyName: 'Fontainebleau Hotel', clientId: 'u-13', date: 'Jul 4, 2026',  payRate: 28, workersNeeded: 3, status: 'in-progress', platformFee: 80,  applicants: [{ id: 'u-06', name: 'Priya Patel',    photoUrl: 'https://i.pravatar.cc/150?img=53', matchPct: 93 }] },
  { id: 's-07', jobType: 'Event Host',       companyName: 'Fontainebleau Hotel', clientId: 'u-13', date: 'Jul 3, 2026',  payRate: 24, workersNeeded: 2, status: 'completed',   platformFee: 46,  applicants: [] },
  { id: 's-08', jobType: 'Busser',           companyName: 'LIV Nightclub',      clientId: 'u-12', date: 'Jul 2, 2026',  payRate: 22, workersNeeded: 4, status: 'completed',   platformFee: 85,  applicants: [] },
  { id: 's-09', jobType: 'Barback',          companyName: '1 Hotel South Beach', clientId: 'u-14', date: 'Jul 7, 2026',  payRate: 20, workersNeeded: 2, status: 'open',        platformFee: 32,  applicants: [{ id: 'u-05', name: 'Kevin Liu',       photoUrl: 'https://i.pravatar.cc/150?img=33', matchPct: 82 }] },
  { id: 's-10', jobType: 'Door Host',        companyName: 'The Rooftop Bar',    clientId: 'u-11', date: 'Jul 5, 2026',  payRate: 25, workersNeeded: 1, status: 'cancelled',   platformFee:  0,  applicants: [] },
];

/* ── Disputes ────────────────────────────────────────────────────────────── */
export const ADMIN_DISPUTES: AdminDispute[] = [
  { id: 'd-01', type: 'no-show',      reportedUserId: 'u-10', reportedUserName: '@derek_s',    reportedByName: '@1hotel_sb',        reason: '2 confirmed no-shows in 10 days. Client left without coverage twice.',            timestamp: 'Today, 7:14 AM',   status: 'open'     },
  { id: 'd-02', type: 'late-cancel',  reportedUserId: 'u-09', reportedUserName: '@aisha_j',    reportedByName: '@liv_miami',        reason: 'Cancelled 3 shifts within 2 hours of start time in past 30 days.',               timestamp: 'Today, 3:52 AM',   status: 'open'     },
  { id: 'd-03', type: 'fake-review',  reportedUserId: 'u-11', reportedUserName: '@rooftopbar_miami', reportedByName: '@marcus_b', reason: 'Suspected fake 1-star review posted to suppress worker rating unfairly.',        timestamp: 'Yesterday, 6:30 PM', status: 'open'   },
  { id: 'd-04', type: 'dress-code',   reportedUserId: 'u-07', reportedUserName: '@brandon_c',  reportedByName: '@rooftopbar_miami', reason: 'Arrived in wrong attire for premium event despite written dress code briefing.', timestamp: '3 days ago',       status: 'warned'   },
  { id: 'd-05', type: 'payment',      reportedUserId: 'u-14', reportedUserName: '@1hotel_sb',  reportedByName: '@kevin_liu',        reason: 'Payment not received 14 days post-shift. Multiple follow-ups ignored.',          timestamp: '5 days ago',       status: 'resolved' },
];

/* ── Derived stats ───────────────────────────────────────────────────────── */
export const ADMIN_STATS = {
  totalUsers:     ADMIN_USERS.length,
  activeShifts:   ADMIN_SHIFTS.filter((s) => ['open', 'filled', 'in-progress'].includes(s.status)).length,
  platformRevenue: ADMIN_SHIFTS.reduce((acc, s) => acc + s.platformFee, 0),
  newSignupsToday: 47,
};
