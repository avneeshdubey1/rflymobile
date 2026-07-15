import { Link } from 'react-router-dom';
import { BellDotIcon, Menu01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../ui/Icon';

interface MobileTopBarProps {
  unreadCount: number;
  menuOpen: boolean;
  onMenuToggle: () => void;
}

export function MobileTopBar({ unreadCount, menuOpen, onMenuToggle }: MobileTopBarProps) {
  return (
    <header className="md:hidden sticky top-0 z-40 h-14 px-4 border-b border-border-subtle bg-white/90 backdrop-blur-md flex items-center justify-between">
      <button
        className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:bg-surface-overlay border-0 bg-transparent cursor-pointer"
        onClick={onMenuToggle}
        type="button"
        aria-label="Menu"
      >
        <Icon icon={menuOpen ? Cancel01Icon : Menu01Icon} size={20} />
      </button>
      <h2 className="text-sm font-bold text-text-primary">PaaS Demo</h2>
      <Link
        to="/notifications"
        className="relative w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary"
        aria-label="Notifications"
      >
        <Icon icon={BellDotIcon} size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </Link>
    </header>
  );
}
