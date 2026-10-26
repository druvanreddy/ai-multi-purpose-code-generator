import { motion } from 'framer-motion';

export default function Card({ children, className = '', hover = false, glow = false, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className={`
        glass-card p-5
        ${hover ? 'glass-card-hover cursor-pointer' : ''}
        ${glow ? 'glow-border' : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
