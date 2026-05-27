/**
 * Office Layout
 *
 * Main 2D Office shell with navigation sidebar (desktop) or tab bar (mobile).
 * Wraps all 5 pages of the main app.
 */

import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'capture', label: 'Capture', icon: '+', path: '/capture' },
  { id: 'map', label: 'Idea Map', icon: '◉', path: '/map' },
  { id: 'projects', label: 'Projects', icon: '▦', path: '/projects' },
  { id: 'completed', label: 'Completed', icon: '✓', path: '/completed' },
  { id: 'memory', label: 'Memory', icon: '◈', path: '/memory' },
];

export function OfficeLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle responsive layout
  useState(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  const currentPage = location.pathname.split('/')[1] || 'capture';

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <nav className="w-[60px] bg-bg-secondary border-r border-border flex flex-col items-center py-lg gap-sm">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center text-lg
                transition-colors duration-200
                ${currentPage === item.id
                  ? 'bg-accent-blue text-text-inverse'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }
              `}
              title={item.label}
            >
              {item.icon}
            </button>
          ))}
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Mobile Tab Bar */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 h-[50px] bg-bg-secondary border-t border-border flex items-center justify-around z-sticky">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`
                flex flex-col items-center gap-xs px-sm py-xs text-xs
                transition-colors duration-200
                ${currentPage === item.id
                  ? 'text-accent-blue'
                  : 'text-text-muted'
                }
              `}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
