import { Link, useLocation } from 'wouter';
import { Home, Briefcase, MessageSquare, Bell, User } from 'lucide-react';

export function BottomTabNav() {
  const [location] = useLocation();

  const tabs = [
    { name: 'Home', path: '/home', icon: Home },
    { name: 'Jobs', path: '/jobs', icon: Briefcase },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="fixed bottom-0 w-full max-w-[390px] bg-[#0A0A0A] border-t border-[#2A2A2A] pb-safe z-50">
      <div className="flex justify-around items-center h-[72px]">
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
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-primary rounded-b-full shadow-[0_2px_8px_rgba(255,215,0,0.5)]" />
              )}
              <Icon 
                size={22} 
                className={`mb-1 transition-colors ${isActive ? 'text-primary' : 'text-[#555555] group-hover:text-[#777777]'}`} 
              />
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-[#555555] group-hover:text-[#777777]'}`}>
                {tab.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
