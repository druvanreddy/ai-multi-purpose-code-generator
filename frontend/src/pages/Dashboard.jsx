import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, LayoutGrid, BarChart3, Zap, Check, Cpu,
  Activity, Clock, Code, Bug, BookOpen, Shield, FileText,
  GitCommit, Database, Server, Container, TestTubes, FileBarChart,
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import MetricCard from '../components/ui/MetricCard';
import { api } from '../utils/api';
import { useSettings } from '../hooks/useSettings';

const features = [
  {
    title: 'AI Assistant',
    icon: Sparkles,
    items: ['Chat with AI', 'Generate Code', 'Debug Code', 'Explain Code', 'Optimize Code', 'Code Review', 'Security Scan', 'Documentation', 'Commit Messages'],
    color: 'from-primary-500/20 to-violet-500/10',
  },
  {
    title: 'Project Builder',
    icon: LayoutGrid,
    items: ['Full Projects', 'REST APIs', 'Database Design', 'Architecture', 'Docker Config', 'SQL Schemas', 'README', 'Documentation', 'Unit Tests'],
    color: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    title: 'Document Intelligence',
    icon: Shield,
    items: ['AI Detection', 'Readability Analysis', 'Stylometric Analysis', 'Citation Analysis', 'Writing Mechanics', 'Humanize Rewrite', 'Report Generation', 'Multi-Format Export'],
    color: 'from-emerald-500/20 to-teal-500/10',
  },
];

const statusItems = [
  'Python Environment',
  'FastAPI Server',
  'Groq SDK',
  'SQLite Database',
  'Configuration Loaded',
  'API Connected',
  'Project Initialized',
  'Ready to Generate',
];

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const { setModels } = useSettings();

  useEffect(() => {
    api.getStatus().then(setStatus).catch(() => setStatus({ success: false }));
    api.getModels().then((d) => setModels(d.models)).catch(() => {});
  }, []);

  return (
    <PageWrapper title="Dashboard" subtitle="Enterprise AI coding assistant powered by Groq">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Version" value={status?.version || '—'} icon={Zap} color="primary" delay={0} />
        <MetricCard label="Model" value={status?.model?.split('/').pop() || '—'} icon={Cpu} color="info" delay={0.05} />
        <MetricCard label="API Status" value={status?.success ? 'Online' : 'Offline'} icon={Activity} color={status?.success ? 'success' : 'warning'} delay={0.1} />
        <MetricCard label="Response Time" value={status?.response_time ? `${status.response_time}s` : '—'} icon={Clock} color="primary" delay={0.15} />
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {features.map((f, i) => (
          <Card key={f.title} hover delay={0.1 + i * 0.05}>
            <div className={`absolute inset-0 bg-gradient-to-br ${f.color} rounded-2xl opacity-40`} />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-white/[0.06]">
                  <f.icon size={18} className="text-primary-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              </div>
              <ul className="space-y-1.5">
                {f.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-surface-400">
                    <div className="w-1 h-1 rounded-full bg-primary-500/50" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        ))}
      </div>

      {/* System Status */}
      <Card delay={0.3}>
        <h3 className="text-sm font-semibold text-white mb-4">System Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statusItems.map((item, i) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.04 }}
              className="flex items-center gap-2 text-xs"
            >
              <Check size={14} className="text-success shrink-0" />
              <span className="text-surface-300">{item}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </PageWrapper>
  );
}
