import { Link } from 'react-router-dom';
import { BellDotIcon, DashboardSquare01Icon } from '@hugeicons/core-free-icons';
import { Icon } from '../../ui/Icon';
import type { User } from '../../../types/domain';

interface TopBarProps {
  unreadCount: number;
  currentUser: User;
}

export function TopBar({ unreadCount, currentUser }: TopBarProps) {
  return (
    <header className="hidden md:flex h-16 px-6 border-b border-border-subtle bg-white/80 backdrop-blur-md items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
          <Icon icon={DashboardSquare01Icon} size={18} className="text-green-600" />
        </div>
        <h1 className="text-[15px] font-bold text-text-primary tracking-tight">PaaS Demo Drone Operations</h1>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/notifications"
          className="relative w-10 h-10 rounded-xl border border-border-subtle bg-white hover:bg-surface-overlay flex items-center justify-center transition-colors"
          aria-label="Notifications"
        >
          <Icon icon={BellDotIcon} size={19} className="text-text-secondary" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Link>

        <Link to="/settings" className="flex items-center gap-3 pl-3 border-l border-border-subtle hover:opacity-80 transition-opacity">
          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-text-primary">{currentUser.name}</span>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{currentUser.role}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 text-white flex items-center justify-center text-xs font-bold shadow-sm">
            {currentUser.name.charAt(0)}
          </div>
        </Link>
      </div>
    </header>
  );
}
