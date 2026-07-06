import { Link, useLocation } from 'wouter';
import { Home, Briefcase, MessageSquare, Bell, User } from 'lucide-react';

export function BottomTabNav() {
  const [location] = useLocation();

  const tabs = [
    { name: 'Home',          path: '/home',          icon: Home          },
    { name: 'Jobs',          path: '/jobs',           icon: Briefcase     },
    { name: 'Messages',      path: '/messages',       icon: MessageSquare },
    { name: 'Notifications', path: '/notifications',  icon: Bell          },
    { name: 'Profile',       path: '/profile',        icon: User          },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-[#DBDBDB] pb-safe z-50">
      <div className="flex justify-around items-center h-[56px]">
        {tabs.map((tab) => {
          const isActive = location === tab.path;
          const Icon = tab.icon;

          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="flex-1 h-full flex flex-col items-center justify-center relative group"
              data-testid={`tab-${tab.name.toLowerCase()}`}
            >
              <Icon
                size={22}
                className={`transition-colors ${isActive ? 'text-black' : 'text-[#737373] group-hover:text-black'}`}
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
