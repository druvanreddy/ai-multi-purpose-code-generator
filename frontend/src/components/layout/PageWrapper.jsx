import { motion } from 'framer-motion';

const variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function PageWrapper({ title, subtitle, actions, children }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-6 p-6 lg:p-8 max-w-6xl"
    >
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && <p className="text-sm text-surface-400 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
      </header>
      {children}
    </motion.div>
  );
}
