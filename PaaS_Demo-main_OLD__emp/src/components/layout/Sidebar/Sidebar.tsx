import { NavLink } from 'react-router-dom';
import { DroneIcon } from '@hugeicons/core-free-icons';
import { Icon } from '../../ui/Icon';
import type { NavItem } from '../AppLayout/navConfig';
import type { User } from '../../../types/domain';

interface SidebarProps {
  navItems: NavItem[];
  currentUser: User;
}

export function Sidebar({ navItems, currentUser }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-[252px] flex-col border-r border-border-subtle bg-white/95 backdrop-blur-sm shrink-0 sticky top-0 h-screen">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white shadow-md shadow-green-200">
          <Icon icon={DroneIcon} size={18} />
        </div>
        <div>
          <p className="text-sm font-bold text-text-primary leading-tight">PaaS Demo</p>
          <p className="text-[11px] text-text-muted leading-tight">Drone Service Platform</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-2 flex flex-col gap-1 overflow-y-auto">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-green-50 text-green-700 border-l-[3px] border-green-500 shadow-sm shadow-green-100'
                  : 'text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
              }`
            }
          >
            <Icon icon={item.icon} size={19} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Role Badge */}
      <div className="px-4 pb-4 mt-auto">
        <div className="rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/60 border border-blue-100 px-3 py-2.5">
          <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Current Role</p>
          <p className="text-xs font-bold text-blue-700 mt-0.5">{currentUser.name}</p>
          <p className="text-[10px] text-blue-500">{currentUser.role}</p>
        </div>
      </div>
    </aside>
  );
}
