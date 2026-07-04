export type StoryWorker = {
  id: string;
  username: string;
  photoUrl: string;
  isPremium: boolean;
  isAvailable: boolean;
};

export type MockShift = {
  id: string;
  jobType: string;
  companyName: string;
  coverImage: string;
  payRate: number;
  payPeriod: 'hr' | 'day' | 'event';
  date: string;
  startTime: string;
  endTime: string;
  distanceMiles: number;
  spotsAvailable: number;
  spotsTotal: number;
  location: string;
  aiMatchPct: number;
  description: string;
  requirements: string[];
  dressCode: string;
  pointOfContact: string;
};

export const STORY_WORKERS: StoryWorker[] = [
  {
    id: 'w1',
    username: 'marcus_b',
    photoUrl: 'https://i.pravatar.cc/150?img=12',
    isPremium: true,
    isAvailable: true,
  },
  {
    id: 'w2',
    username: 'jade_r',
    photoUrl: 'https://i.pravatar.cc/150?img=47',
    isPremium: false,
    isAvailable: true,
  },
  {
    id: 'w3',
    username: 'tyrone_w',
    photoUrl: 'https://i.pravatar.cc/150?img=15',
    isPremium: true,
    isAvailable: true,
  },
  {
    id: 'w4',
    username: 'sofia_m',
    photoUrl: 'https://i.pravatar.cc/150?img=44',
    isPremium: false,
    isAvailable: true,
  },
  {
    id: 'w5',
    username: 'dani_k',
    photoUrl: 'https://i.pravatar.cc/150?img=32',
    isPremium: true,
    isAvailable: true,
  },
  {
    id: 'w6',
    username: 'alex_p',
    photoUrl: 'https://i.pravatar.cc/150?img=8',
    isPremium: false,
    isAvailable: true,
  },
  {
    id: 'w7',
    username: 'maya_j',
    photoUrl: 'https://i.pravatar.cc/150?img=56',
    isPremium: true,
    isAvailable: true,
  },
  {
    id: 'w8',
    username: 'derek_l',
    photoUrl: 'https://i.pravatar.cc/150?img=3',
    isPremium: false,
    isAvailable: true,
  },
];

export const MOCK_SHIFTS: MockShift[] = [
  {
    id: 'shift-1',
    jobType: 'Bartender',
    companyName: 'The Rooftop Bar',
    coverImage:
      'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop&q=80',
    payRate: 35,
    payPeriod: 'hr',
    date: 'Tonight',
    startTime: '9:00 PM',
    endTime: '3:00 AM',
    distanceMiles: 1.2,
    spotsAvailable: 2,
    spotsTotal: 4,
    location: 'Miami Beach, FL',
    aiMatchPct: 97,
    description:
      'High-volume craft cocktail bar atop the 1 Hotel South Beach. Looking for experienced bartenders comfortable with speed and precision during peak rooftop service hours.',
    requirements: ['2+ yrs bartending', 'Craft cocktail knowledge', 'TIPS certified'],
    dressCode: 'All black uniform provided',
    pointOfContact: 'Samantha Cruz',
  },
  {
    id: 'shift-2',
    jobType: 'Cocktail Server',
    companyName: 'Grand Hyatt Gala',
    coverImage:
      'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&auto=format&fit=crop&q=80',
    payRate: 28,
    payPeriod: 'hr',
    date: 'Tomorrow',
    startTime: '7:00 PM',
    endTime: '1:00 AM',
    distanceMiles: 2.8,
    spotsAvailable: 5,
    spotsTotal: 10,
    location: 'Downtown Miami, FL',
    aiMatchPct: 91,
    description:
      'Corporate gala for 400 guests at the Grand Hyatt Ballroom. Seeking polished cocktail servers for a black-tie charity event benefiting youth arts programs.',
    requirements: ['Fine dining experience', 'Professional demeanor', 'English + Spanish preferred'],
    dressCode: 'Black tie — formal wear provided',
    pointOfContact: 'James Whitfield',
  },
  {
    id: 'shift-3',
    jobType: 'Security',
    companyName: 'LIV Nightclub',
    coverImage:
      'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800&auto=format&fit=crop&q=80',
    payRate: 25,
    payPeriod: 'hr',
    date: 'Fri Jul 5',
    startTime: '10:00 PM',
    endTime: '4:00 AM',
    distanceMiles: 0.9,
    spotsAvailable: 2,
    spotsTotal: 6,
    location: 'Miami Beach, FL',
    aiMatchPct: 84,
    description:
      'LIV is seeking experienced crowd-control security for a sold-out DJ residency. Must be comfortable managing VIP lines and guest de-escalation in a high-energy nightlife environment.',
    requirements: ['G License (FL)', '200 lbs+ preferred', 'Nightclub experience'],
    dressCode: 'Black LIV polo + black slacks',
    pointOfContact: 'Ricardo Vega',
  },
  {
    id: 'shift-4',
    jobType: 'Brand Ambassador',
    companyName: 'Nike Launch Event',
    coverImage:
      'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&auto=format&fit=crop&q=80',
    payRate: 30,
    payPeriod: 'hr',
    date: 'Sat Jul 6',
    startTime: '12:00 PM',
    endTime: '8:00 PM',
    distanceMiles: 3.5,
    spotsAvailable: 8,
    spotsTotal: 12,
    location: 'Wynwood, FL',
    aiMatchPct: 88,
    description:
      'Nike Footwear is launching the Air Max 2026 in Wynwood. Looking for outgoing, fashion-forward brand ambassadors to engage consumers, distribute samples, and capture social content.',
    requirements: ['Outgoing personality', 'Social media presence preferred', 'Bilingual a plus'],
    dressCode: 'Casual — Nike gear provided',
    pointOfContact: 'Tasha Monroe',
  },
  {
    id: 'shift-5',
    jobType: 'Event Setup',
    companyName: 'Art Basel Miami',
    coverImage:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
    payRate: 22,
    payPeriod: 'hr',
    date: 'Sat Jul 6',
    startTime: '7:00 AM',
    endTime: '3:00 PM',
    distanceMiles: 5.1,
    spotsAvailable: 12,
    spotsTotal: 20,
    location: 'Miami Beach Conv. Ctr.',
    aiMatchPct: 79,
    description:
      'Setup crew needed for the premier contemporary art fair. Tasks include booth assembly, art hanging assistance, signage installation, and venue prep across 250,000 sq ft of exhibition space.',
    requirements: ['Physical stamina', 'Attention to detail', 'Team player'],
    dressCode: 'Comfortable work clothes + closed-toe shoes',
    pointOfContact: 'Luis Fontaine',
  },
  {
    id: 'shift-6',
    jobType: 'Catering Lead',
    companyName: 'Private Estate',
    coverImage:
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop&q=80',
    payRate: 42,
    payPeriod: 'hr',
    date: 'Sun Jul 7',
    startTime: '5:00 PM',
    endTime: '11:00 PM',
    distanceMiles: 8.2,
    spotsAvailable: 1,
    spotsTotal: 2,
    location: 'Coral Gables, FL',
    aiMatchPct: 93,
    description:
      'Intimate dinner for 30 guests at a private Coral Gables estate. We need an experienced catering lead to oversee plated service, coordinate the kitchen team, and ensure impeccable presentation for UHNW clientele.',
    requirements: ['Fine dining lead experience', 'Wine knowledge', 'Reliable transportation'],
    dressCode: 'Formal — white glove service',
    pointOfContact: 'Elena Marchetti',
  },
  {
    id: 'shift-7',
    jobType: 'Host / Hostess',
    companyName: 'NoMad Restaurant',
    coverImage:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
    payRate: 26,
    payPeriod: 'hr',
    date: 'Mon Jul 8',
    startTime: '5:30 PM',
    endTime: '11:30 PM',
    distanceMiles: 1.7,
    spotsAvailable: 3,
    spotsTotal: 4,
    location: 'Brickell, Miami, FL',
    aiMatchPct: 86,
    description:
      'NoMad Miami is seeking a warm, polished host or hostess for a busy Monday dinner service. You will manage reservations via SevenRooms, greet guests, and coordinate seating for a 180-cover dining room.',
    requirements: ['SevenRooms or OpenTable experience', 'Hospitality degree a plus', 'Fluent English'],
    dressCode: 'All-black professional attire',
    pointOfContact: 'Natalie Osei',
  },
  {
    id: 'shift-8',
    jobType: 'VIP Server',
    companyName: 'Fontainebleau Hotel',
    coverImage:
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80',
    payRate: 34,
    payPeriod: 'hr',
    date: 'Fri Jul 11',
    startTime: '8:00 PM',
    endTime: '2:00 AM',
    distanceMiles: 2.3,
    spotsAvailable: 4,
    spotsTotal: 8,
    location: 'Miami Beach, FL',
    aiMatchPct: 90,
    description:
      'The iconic Fontainebleau is seeking VIP servers for LIV pool party weekend. Handle high-profile table service, bottle presentations, and celebrity guest relations with professionalism and discretion.',
    requirements: ['VIP/bottle service experience', 'Upbeat professional attitude', 'TIPS certified'],
    dressCode: 'Fontainebleau uniform provided',
    pointOfContact: 'David Park',
  },
];
