import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Home, Sparkles, LayoutGrid, FileText, FileBarChart,
  Shield, Clock, BarChart3, Settings, Menu, X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

const NAV = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/assistant', icon: Sparkles, label: 'AI Assistant' },
  { to: '/builder', icon: LayoutGrid, label: 'Project Builder' },
  { to: '/files', icon: FileText, label: 'File Analyzer' },
  { to: '/report', icon: FileBarChart, label: 'Report Generator' },
  { to: '/detector', icon: Shield, label: 'AI Detector' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.getStatus().then((d) => setStatus(d)).catch(() => setStatus(null));
  }, []);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-xl bg-surface-800/80 backdrop-blur-sm border border-white/[0.06] text-surface-300"
      >
        <Menu size={20} />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen z-50 flex flex-col
          bg-surface-950/90 backdrop-blur-2xl border-r border-white/[0.04]
          transition-all duration-300 ease-out
          ${collapsed ? 'w-[72px]' : 'w-[260px]'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 h-16 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-primary-700 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">&lt;/&gt;</span>
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="overflow-hidden"
            >
              <div className="font-bold text-white text-sm tracking-wide">DMIXERAI</div>
              <div className="text-[10px] text-primary-400 font-semibold tracking-widest">PRO</div>
            </motion.div>
          )}

          {/* Collapse / close buttons */}
          <button
            onClick={() => { setCollapsed(!collapsed); setMobileOpen(false); }}
            className="ml-auto text-surface-500 hover:text-white transition-colors hidden lg:block"
          >
            <Menu size={16} />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto text-surface-500 hover:text-white transition-colors lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 relative
                ${isActive
                  ? 'text-white bg-white/[0.08]'
                  : 'text-surface-400 hover:text-white hover:bg-white/[0.04]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary-500"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon size={18} className={isActive ? 'text-primary-400' : 'text-surface-500 group-hover:text-surface-300'} />
                  {!collapsed && <span>{label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer status */}
        <div className="px-3 pb-4 shrink-0">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${collapsed ? 'justify-center' : ''}`}>
            <div className={`w-2 h-2 rounded-full shrink-0 ${status?.success ? 'bg-success animate-pulse' : 'bg-danger'}`} />
            {!collapsed && (
              <span className="text-surface-500 truncate">
                {status?.success ? 'Connected' : 'Offline'}
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
