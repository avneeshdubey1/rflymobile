import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../context/useAuth';
import ChatPanel from '../components/ChatPanel';
import PilotMissionPanel from '../components/PilotMissionPanel';
import OperationsShell from '../components/OperationsShell';

function PilotDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('tasks');
  const navItems = [
    { id: 'tasks', label: 'Mission queue', icon: 'drone' },
    { id: 'chat', label: 'Support desk', icon: 'chat' },
  ];

  return (
    <OperationsShell roleLabel="Pilot operations" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} user={user} logout={logout}>
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
            {activeTab === 'tasks' ? <PilotMissionPanel /> : <ChatPanel />}
          </motion.div>
        </AnimatePresence>
    </OperationsShell>
  );
}

export default PilotDashboard;
