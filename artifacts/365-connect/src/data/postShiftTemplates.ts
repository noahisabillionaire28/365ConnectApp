// Canonical 14-entry job-type list — single source of truth for all wizards
import {
  Wine, UtensilsCrossed, Disc3, ChefHat, ShieldCheck,
  UserCheck, Camera, Megaphone, Anchor, Briefcase,
  Building2, Sparkles, Bed, Utensils,
  type LucideIcon,
} from 'lucide-react';

export type JobTemplate = {
  id: string;
  label: string;
  Icon: LucideIcon;
  payRate: number;
  workersNeeded: number;
  dressCode: string;
  dressCodeItems: string[];
  description: string;
};

export const JOB_TEMPLATES: JobTemplate[] = [
  {
    id: 'bartender',
    label: 'Bartender',
    Icon: Wine,
    payRate: 35,
    workersNeeded: 2,
    dressCode: 'All Black',
    dressCodeItems: ['All Black', 'Black Dress Shirt', 'Black Slacks', 'Black Non-Slip Shoes', 'Black Belt'],
    description: 'We are looking for experienced bartenders for a high-volume event. Must have craft cocktail knowledge and be comfortable in a fast-paced environment. TIPS certification preferred.',
  },
  {
    id: 'server',
    label: 'Server',
    Icon: UtensilsCrossed,
    payRate: 26,
    workersNeeded: 4,
    dressCode: 'All Black',
    dressCodeItems: ['All Black', 'Black Dress Shirt', 'Black Slacks', 'Black Non-Slip Shoes'],
    description: 'Seeking polished servers for a private dining event. Fine dining experience preferred. Must be able to carry a full tray and deliver exceptional guest service.',
  },
  {
    id: 'dj',
    label: 'DJ',
    Icon: Disc3,
    payRate: 150,
    workersNeeded: 1,
    dressCode: 'Smart Casual',
    dressCodeItems: ['Smart Casual', 'No Ripped Jeans', 'Clean Sneakers OK'],
    description: 'Looking for an experienced DJ for a private event. Must supply your own equipment. Experience with weddings, corporate events, or nightclub settings preferred.',
  },
  {
    id: 'caterer',
    label: 'Caterer',
    Icon: ChefHat,
    payRate: 30,
    workersNeeded: 3,
    dressCode: 'Chef Whites',
    dressCodeItems: ['Chef Whites', 'Non-Slip Shoes', 'Hair Tied Back', 'No Jewelry'],
    description: 'Experienced catering staff needed for a corporate luncheon. Must have food handling certification and experience with buffet-style service or plated meals.',
  },
  {
    id: 'security',
    label: 'Security',
    Icon: ShieldCheck,
    payRate: 25,
    workersNeeded: 3,
    dressCode: 'All Black',
    dressCodeItems: ['All Black', 'Black Polo or Dress Shirt', 'Black Pants', 'Black Boots'],
    description: 'G-licensed security personnel needed for crowd management at a venue event. Must have experience with guest screening, VIP access management, and de-escalation techniques.',
  },
  {
    id: 'hostess',
    label: 'Hostess',
    Icon: UserCheck,
    payRate: 24,
    workersNeeded: 2,
    dressCode: 'All Black Professional',
    dressCodeItems: ['All Black', 'Black Dress or Blouse', 'Black Heels or Flats', 'Minimal Jewelry'],
    description: 'Warm, professional host/hostess needed to greet guests and manage reservations. Experience with OpenTable or SevenRooms is a plus. Bilingual candidates preferred.',
  },
  {
    id: 'promo-model',
    label: 'Promo Model',
    Icon: Camera,
    payRate: 28,
    workersNeeded: 4,
    dressCode: 'Brand Provided',
    dressCodeItems: ['Brand Provided Outfit', 'Neutral Makeup', 'Clean Appearance', 'Comfortable Heels OK'],
    description: 'Seeking outgoing promotional models for a product activation event. Must be comfortable interacting with the public and taking/appearing in photos and videos.',
  },
  {
    id: 'brand-ambassador',
    label: 'Brand Ambassador',
    Icon: Megaphone,
    payRate: 30,
    workersNeeded: 5,
    dressCode: 'Brand Provided',
    dressCodeItems: ['Brand Gear Provided', 'Clean White Sneakers', 'Casual-Smart'],
    description: 'Brand ambassadors needed to represent our brand at a launch event. Must be enthusiastic, personable, and comfortable engaging consumers, distributing samples, and driving social content creation.',
  },
  {
    id: 'captain',
    label: 'Captain',
    Icon: Anchor,
    payRate: 45,
    workersNeeded: 1,
    dressCode: 'Formal Black',
    dressCodeItems: ['All Black', 'Black Dress Shirt', 'Black Vest', 'Black Dress Pants', 'Black Dress Shoes'],
    description: 'Experienced event captain needed to oversee front-of-house operations. Must have strong leadership skills and ability to coordinate staff across bar, floor, and kitchen teams.',
  },
  {
    id: 'manager',
    label: 'Manager',
    Icon: Briefcase,
    payRate: 50,
    workersNeeded: 1,
    dressCode: 'Business Professional',
    dressCodeItems: ['Business Formal', 'Dark Suit Preferred', 'Dress Shoes', 'Minimal Accessories'],
    description: 'Event manager needed to oversee all logistics and staff coordination for a large-scale event. Must have 3+ years of event management experience and excellent communication skills.',
  },
  {
    id: 'house-manager',
    label: 'House Manager',
    Icon: Building2,
    payRate: 40,
    workersNeeded: 1,
    dressCode: 'All Black Professional',
    dressCodeItems: ['All Black', 'Black Dress Shirt', 'Black Slacks', 'Black Dress Shoes'],
    description: 'House manager needed to oversee venue operations during a multi-day event. Responsibilities include staff scheduling, vendor coordination, and guest experience management.',
  },
  {
    id: 'cleaner',
    label: 'Cleaner',
    Icon: Sparkles,
    payRate: 20,
    workersNeeded: 4,
    dressCode: 'Comfortable Work Clothes',
    dressCodeItems: ['Comfortable Clothes', 'Closed-Toe Shoes', 'Hair Tied Back', 'Gloves Provided'],
    description: 'Event cleaners needed for pre-event setup and post-event breakdown and cleanup. Tasks include venue preparation, restroom maintenance, and post-event deep clean.',
  },
  {
    id: 'housekeeper',
    label: 'Housekeeper',
    Icon: Bed,
    payRate: 22,
    workersNeeded: 3,
    dressCode: 'Uniform Provided',
    dressCodeItems: ['Uniform Provided', 'Non-Slip Shoes', 'Hair Tied Back', 'No Perfume'],
    description: 'Professional housekeepers needed for a luxury property. Must have experience with turndown service, laundry, and maintaining impeccable cleanliness standards in a high-end environment.',
  },
  {
    id: 'busser',
    label: 'Busser',
    Icon: Utensils,
    payRate: 18,
    workersNeeded: 4,
    dressCode: 'All Black',
    dressCodeItems: ['All Black', 'Black T-Shirt or Polo', 'Black Pants', 'Non-Slip Shoes'],
    description: 'Bussers needed to support front-of-house operations during a busy service. Responsibilities include clearing tables, resetting place settings, and assisting servers as needed.',
  },
];

