import { NavLink } from 'react-router-dom';
import { Icon } from '../../ui/Icon';
import type { NavItem } from '../AppLayout/navConfig';

interface MobileMenuSheetProps {
  items: NavItem[];
  onClose: () => void;
}

export function MobileMenuSheet({ items, onClose }: MobileMenuSheetProps) {
  return (
    <div className="md:hidden fixed inset-0 top-14 z-50 bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white border-t border-border-subtle rounded-b-2xl shadow-xl p-4 flex flex-col gap-2 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {items.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            onClick={onClose}
            className="flex items-center gap-3 h-12 px-4 rounded-xl text-sm font-medium text-text-primary hover:bg-surface-overlay transition-colors"
          >
            <Icon icon={tab.icon} size={19} />
            {tab.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
