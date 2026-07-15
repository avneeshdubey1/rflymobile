import type { IconSvgElement } from '@hugeicons/react';
import type { UserRole } from '../../../types/domain';
import {
  Home03Icon, Task01Icon, DroneIcon, Invoice01Icon, Analytics01Icon,
  UserGroupIcon, Notification01Icon, Settings01Icon,
} from '@hugeicons/core-free-icons';

export interface NavItem {
  to: string;
  label: string;
  icon: IconSvgElement;
  roles: UserRole[];
}

const allNavItems: NavItem[] = [
  { to: '/dashboard',        label: 'Home',          icon: Home03Icon,         roles: ['Admin', 'Pilot', 'Ops', 'Finance', 'BC', 'BB', 'Representative'] },
  { to: '/requests',         label: 'Requests',      icon: Task01Icon,         roles: ['Admin', 'Ops', 'BC', 'BB'] },
  { to: '/pilot/jobs',       label: 'My Jobs',       icon: DroneIcon,          roles: ['Pilot'] },
  { to: '/ops/tracker',      label: 'Tracker',       icon: Task01Icon,         roles: ['Ops', 'Admin'] },
  { to: '/finance/invoices', label: 'Invoices',      icon: Invoice01Icon,      roles: ['Finance', 'Admin'] },
  { to: '/analytics',        label: 'Analytics',     icon: Analytics01Icon,    roles: ['Admin', 'Finance'] },
  { to: '/users',            label: 'Users',         icon: UserGroupIcon,      roles: ['Admin'] },
  { to: '/approvals',        label: 'My Approvals',  icon: Task01Icon,         roles: ['Representative'] },
  { to: '/notifications',    label: 'Alerts',        icon: Notification01Icon, roles: ['Admin', 'Pilot', 'Ops', 'Finance', 'BC', 'BB', 'Representative'] },
  { to: '/settings',         label: 'Settings',      icon: Settings01Icon,     roles: ['Admin', 'Pilot', 'Ops', 'Finance', 'BC', 'BB', 'Representative'] },
];

export function getNavItems(role: UserRole): NavItem[] {
  return allNavItems.filter(item => item.roles.includes(role));
}
