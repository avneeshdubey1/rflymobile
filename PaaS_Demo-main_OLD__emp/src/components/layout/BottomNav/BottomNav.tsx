import { NavLink } from 'react-router-dom';
import { Icon } from '../../ui/Icon';
import type { NavItem } from '../AppLayout/navConfig';

interface BottomNavProps {
  items: NavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-white border-t border-border-subtle grid shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
      style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
              isActive ? 'text-green-600 border-t-2 border-green-500 bg-green-50/50' : 'text-text-secondary'
            }`
          }
        >
          <Icon icon={item.icon} size={21} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
