import { motion } from 'framer-motion';

export default function MetricCard({ label, value, icon: Icon, color = 'primary', delay = 0 }) {
  const colors = {
    primary: 'from-primary-500/10 to-primary-500/5 border-primary-500/20 text-primary-400',
    success: 'from-success/10 to-success/5 border-success/20 text-success',
    warning: 'from-warning/10 to-warning/5 border-warning/20 text-warning',
    info: 'from-info/10 to-info/5 border-info/20 text-info',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-surface-400 font-medium uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold text-white mt-1.5">{value}</p>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl bg-surface-800/40`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
