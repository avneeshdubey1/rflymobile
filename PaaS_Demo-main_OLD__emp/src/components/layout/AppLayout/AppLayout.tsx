import type { ReactNode } from 'react';
import type { User } from '../../../types/domain';
import { Sidebar } from '../Sidebar/Sidebar';
import { TopBar } from '../TopBar/TopBar';
import { MobileTopBar } from '../TopBar/MobileTopBar';
import { BottomNav } from '../BottomNav/BottomNav';
import { MobileMenuSheet } from '../BottomNav/MobileMenuSheet';
import { useState } from 'react';
import { ToastContainer } from '../../ui/Toast/Toast';
import { getNavItems } from './navConfig';

interface AppLayoutProps {
  children: ReactNode;
  currentUser: User;
  unreadCount: number;
}

export function AppLayout({ children, currentUser, unreadCount }: AppLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleNav = getNavItems(currentUser.role);
  const mobileTabs = visibleNav.slice(0, 4);
  const moreItems = visibleNav.slice(4);

  return (
    <div 
      className="relative min-h-screen flex bg-surface-base"
      style={{ backgroundImage: 'url(/images/bg-pattern.png)', backgroundSize: 'cover', backgroundAttachment: 'fixed', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-0 pointer-events-none" />
      <div className="relative z-10 flex w-full h-full">
        <ToastContainer />
      <Sidebar navItems={visibleNav} currentUser={currentUser} />

      <section className="flex-1 min-w-0 flex flex-col">
        <TopBar unreadCount={unreadCount} currentUser={currentUser} />
        <MobileTopBar unreadCount={unreadCount} menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(p => !p)} />

        {menuOpen && (
          <MobileMenuSheet
            items={moreItems}
            onClose={() => setMenuOpen(false)}
          />
        )}

        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6 overflow-y-auto">
          {children}
        </main>

        <BottomNav items={mobileTabs} />
      </section>
      </div>
    </div>
  );
}
