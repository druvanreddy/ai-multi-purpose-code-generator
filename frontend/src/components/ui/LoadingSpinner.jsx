import { motion } from 'framer-motion';

export default function LoadingSpinner({ text = 'Generating…', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-12 ${className}`}>
      <div className="relative w-10 h-10">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary-500/20"
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
      <p className="text-sm text-surface-400">{text}</p>
    </div>
  );
}
