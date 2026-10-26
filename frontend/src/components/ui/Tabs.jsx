import { motion } from 'framer-motion';

export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 p-1 bg-surface-900/40 rounded-2xl overflow-x-auto border border-white/[0.04]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`relative px-4 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap transition-colors duration-200 ${
            active === tab.key ? 'text-white' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          {active === tab.key && (
            <motion.div
              layoutId="tab-bg"
              className="absolute inset-0 bg-white/[0.08] rounded-xl"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            {tab.icon && <tab.icon size={15} />}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
}
