export type Segment = {
  text: string;
  /** Gold + semibold — for @mentions, venue names */
  mention?: boolean;
  /** White + bold — for key amounts or role names */
  strong?: boolean;
};

export type NotificationType =
  | 'new-shift'
  | 'shift-accepted'
  | 'shift-applied'
  | 'shift-reminder'
  | 'payment'
  | 'review';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  /** pravatar URL — for person-based events */
  actorPhoto?: string;
  /** Replaces actorPhoto for system events */
  iconColor?: string;
  segments: Segment[];
  timestamp: string;
  section: 'today' | 'week';
  unread: boolean;
  /** Small venue image shown on the right for new-shift */
  shiftThumb?: string;
  /** Star count shown on right for reviews */
  stars?: number;
};

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  /* ══ Today ══════════════════════════════════════════════════════════════ */
  {
    id: 'n-01',
    type: 'shift-reminder',
    iconColor: 'amber',
    segments: [
      { text: 'Your ' },
      { text: 'Bartender', strong: true },
      { text: ' shift at ' },
      { text: 'The Rooftop Bar', mention: true },
      { text: ' starts in ' },
      { text: '2 hours', strong: true },
      { text: '. Clock in is ready.' },
    ],
    timestamp: '25m ago',
    section: 'today',
    unread: true,
  },
  {
    id: 'n-02',
    type: 'payment',
    iconColor: 'green',
    segments: [
      { text: 'Payment of ' },
      { text: '$224.00', strong: true },
      { text: ' received for your Friday shift at ' },
      { text: '1 Hotel South Beach', mention: true },
      { text: '.' },
    ],
    timestamp: '1h ago',
    section: 'today',
    unread: true,
  },
  {
    id: 'n-03',
    type: 'shift-accepted',
    actorPhoto: 'https://i.pravatar.cc/150?img=68',
    segments: [
      { text: '@jsmith', mention: true },
      { text: ' accepted your ' },
      { text: 'Sunday Server', strong: true },
      { text: ' shift. You\'re all set!' },
    ],
    timestamp: '2h ago',
    section: 'today',
    unread: true,
  },
  {
    id: 'n-04',
    type: 'review',
    actorPhoto: 'https://i.pravatar.cc/150?img=59',
    segments: [
      { text: '@rooftopbar_miami', mention: true },
      { text: ' left you a ' },
      { text: '5-star review', strong: true },
      { text: ': "Exceptional work, highly recommend!"' },
    ],
    timestamp: '3h ago',
    section: 'today',
    unread: false,
    stars: 5,
  },
  {
    id: 'n-05',
    type: 'shift-applied',
    actorPhoto: 'https://i.pravatar.cc/150?img=44',
    segments: [
      { text: '@venue_la', mention: true },
      { text: ' applied to your ' },
      { text: 'Sunday Bartender', strong: true },
      { text: ' shift. Review their profile.' },
    ],
    timestamp: '5h ago',
    section: 'today',
    unread: false,
  },

  /* ══ This Week ═══════════════════════════════════════════════════════════ */
  {
    id: 'n-06',
    type: 'new-shift',
    iconColor: 'gold',
    segments: [
      { text: 'New ' },
      { text: 'Bartender', strong: true },
      { text: ' shift near you — ' },
      { text: '$28/hr', strong: true },
      { text: ' this Saturday at ' },
      { text: 'Fontainebleau Hotel', mention: true },
      { text: '.' },
    ],
    timestamp: '2d ago',
    section: 'week',
    unread: false,
    shiftThumb:
      'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=160&q=80',
  },
  {
    id: 'n-07',
    type: 'shift-accepted',
    actorPhoto: 'https://i.pravatar.cc/150?img=47',
    segments: [
      { text: '@sofia_m', mention: true },
      { text: ' accepted your ' },
      { text: 'Security', strong: true },
      { text: ' shift at ' },
      { text: 'LIV Nightclub', mention: true },
      { text: '.' },
    ],
    timestamp: '3d ago',
    section: 'week',
    unread: false,
  },
  {
    id: 'n-08',
    type: 'review',
    actorPhoto: 'https://i.pravatar.cc/150?img=15',
    segments: [
      { text: '@livnightclub_miami', mention: true },
      { text: ' left you a ' },
      { text: '5-star review', strong: true },
      { text: ': "Punctual, professional, and great energy!"' },
    ],
    timestamp: '4d ago',
    section: 'week',
    unread: false,
    stars: 5,
  },
  {
    id: 'n-09',
    type: 'payment',
    iconColor: 'green',
    segments: [
      { text: 'Payment of ' },
      { text: '$168.00', strong: true },
      { text: ' received for your Wednesday shift at ' },
      { text: 'LIV Nightclub', mention: true },
      { text: '.' },
    ],
    timestamp: '5d ago',
    section: 'week',
    unread: false,
  },
];
