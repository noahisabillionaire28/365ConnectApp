export type Participant = {
  id: string;
  username: string;
  displayName: string;
  photoUrl: string;
  role: 'worker' | 'client';
};

export type Message = {
  id: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  timestamp: string; // display string e.g. "9:12 PM"
  status: 'sent' | 'read';
};

export type Conversation = {
  id: string;
  isGroup: boolean;
  groupName?: string;
  /** Other participants (excludes ME) */
  participants: Participant[];
  messages: Message[];
  unread: boolean;
};

/* ─── Current user ───────────────────────────────────────────────────────── */
export const ME: Participant = {
  id: 'me',
  username: 'marcus_b',
  displayName: 'Marcus Brown',
  photoUrl: 'https://i.pravatar.cc/150?img=12',
  role: 'worker',
};

/* ─── Other participants ─────────────────────────────────────────────────── */
const JAMES: Participant = {
  id: 'james-w',
  username: 'rooftopbar_miami',
  displayName: 'James Whitfield',
  photoUrl: 'https://i.pravatar.cc/150?img=68',
  role: 'client',
};

const RICARDO: Participant = {
  id: 'ricardo-v',
  username: 'liv_miami',
  displayName: 'Ricardo Vega · LIV',
  photoUrl: 'https://i.pravatar.cc/150?img=59',
  role: 'client',
};

const JADE: Participant = {
  id: 'jade-r',
  username: 'jade_r',
  displayName: 'Jade Rivera',
  photoUrl: 'https://i.pravatar.cc/150?img=47',
  role: 'worker',
};

const TYRONE: Participant = {
  id: 'tyrone-w',
  username: 'tyrone_w',
  displayName: 'Tyrone Williams',
  photoUrl: 'https://i.pravatar.cc/150?img=15',
  role: 'worker',
};

const SOFIA: Participant = {
  id: 'sofia-m',
  username: 'sofia_m',
  displayName: 'Sofia Martinez',
  photoUrl: 'https://i.pravatar.cc/150?img=44',
  role: 'worker',
};

/* ─── Mock conversations ─────────────────────────────────────────────────── */
export const MOCK_CONVERSATIONS: Conversation[] = [
  /* ── 1: Client DM — The Rooftop Bar (unread) ── */
  {
    id: 'conv-1',
    isGroup: false,
    participants: [JAMES],
    unread: true,
    messages: [
      {
        id: 'm1-1',
        senderId: 'james-w',
        text: "Hey Marcus! You're confirmed for the Saturday bartender shift at 1 Hotel South Beach. 🥂",
        timestamp: '8:22 PM',
        status: 'read',
      },
      {
        id: 'm1-2',
        senderId: 'me',
        text: "Amazing, thank you! What's the dress code?",
        timestamp: '8:35 PM',
        status: 'read',
      },
      {
        id: 'm1-3',
        senderId: 'james-w',
        text: 'All black — dress shirt, slacks, non-slip shoes. Arrive 30 min early for the setup briefing.',
        timestamp: '8:41 PM',
        status: 'read',
      },
      {
        id: 'm1-4',
        senderId: 'me',
        text: 'Perfect. Will do 👍',
        timestamp: '8:42 PM',
        status: 'read',
      },
      {
        id: 'm1-img',
        senderId: 'james-w',
        text: "Here's the venue layout for bar stations:",
        imageUrl:
          'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=480&q=80',
        timestamp: '8:45 PM',
        status: 'read',
      },
      {
        id: 'm1-5',
        senderId: 'james-w',
        text: "Also — tips are pooled. You'll receive your cut via direct deposit within 48 hours after the event.",
        timestamp: '9:12 PM',
        status: 'sent', // unread (not read by ME yet)
      },
    ],
  },

  /* ── 2: Group chat — LIV Event Staff ── */
  {
    id: 'conv-2',
    isGroup: true,
    groupName: 'LIV Event Staff — Jul 6',
    participants: [RICARDO, JADE, TYRONE, SOFIA],
    unread: false,
    messages: [
      {
        id: 'm2-1',
        senderId: 'ricardo-v',
        text: 'Hey team! Quick briefing for Sunday. Security posts will be at main entrance, VIP staircase, and poolside.',
        timestamp: '2:10 PM',
        status: 'read',
      },
      {
        id: 'm2-2',
        senderId: 'tyrone-w',
        text: 'Got it. Any specific dress code for security this event?',
        timestamp: '2:18 PM',
        status: 'read',
      },
      {
        id: 'm2-3',
        senderId: 'ricardo-v',
        text: 'All black, LIV polo provided on arrival. Boots recommended — poolside can get slippery.',
        timestamp: '2:22 PM',
        status: 'read',
      },
      {
        id: 'm2-4',
        senderId: 'me',
        text: 'What time should we be there for setup?',
        timestamp: '2:31 PM',
        status: 'read',
      },
      {
        id: 'm2-5',
        senderId: 'jade-r',
        text: 'Same question here 👆',
        timestamp: '2:33 PM',
        status: 'read',
      },
      {
        id: 'm2-6',
        senderId: 'ricardo-v',
        text: 'Team, doors open at 10 PM. Everyone on-site by 9 PM sharp. See you Sunday! 🔒',
        timestamp: '2:38 PM',
        status: 'read',
      },
    ],
  },

  /* ── 3: Peer DM — Jade Rivera (worker) ── */
  {
    id: 'conv-3',
    isGroup: false,
    participants: [JADE],
    unread: false,
    messages: [
      {
        id: 'm3-1',
        senderId: 'jade-r',
        text: "Marcus! Did you see the new Fontainebleau posting? VIP Server, $42/hr 👀",
        timestamp: 'Yesterday',
        status: 'read',
      },
      {
        id: 'm3-2',
        senderId: 'me',
        text: 'Yeah I saw it! Already applied. That AI match was 96% 😤',
        timestamp: 'Yesterday',
        status: 'read',
      },
      {
        id: 'm3-3',
        senderId: 'jade-r',
        text: "Lmao same, we're probably competing 😅. May the best bartender win",
        timestamp: 'Yesterday',
        status: 'read',
      },
      {
        id: 'm3-4',
        senderId: 'me',
        text: "You working the Fontainebleau thing Saturday?",
        timestamp: 'Yesterday',
        status: 'read',
      },
    ],
  },
];
