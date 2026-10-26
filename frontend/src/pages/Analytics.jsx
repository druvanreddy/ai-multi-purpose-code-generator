import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, PieChart, TrendingUp, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RPieChart, Pie, Cell, Legend,
} from 'recharts';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import MetricCard from '../components/ui/MetricCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { api } from '../utils/api';

const COLORS = ['#6c5ce7', '#a29bfe', '#00cec9', '#fdcb6e', '#e17055', '#74b9ff', '#55efc4', '#ff7675'];

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <PageWrapper title="Analytics"><LoadingSpinner text="Loading analytics…" /></PageWrapper>;
  if (!data) return <PageWrapper title="Analytics"><p className="text-sm text-surface-500">No analytics data available yet.</p></PageWrapper>;

  const featureCounts = data.feature_usage
    ? Object.entries(data.feature_usage).map(([name, value]) => ({ name, value }))
    : [];

  const dailyCounts = data.daily_usage
    ? Object.entries(data.daily_usage).map(([date, count]) => ({ date, count }))
    : [];

  return (
    <PageWrapper
      title="Analytics"
      subtitle="Usage statistics and trends"
      actions={<button onClick={load} className="btn-ghost !text-xs"><RefreshCw size={14} /> Refresh</button>}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard icon={BarChart3} label="Total Requests" value={data.total_requests ?? 0} index={0} />
        <MetricCard icon={TrendingUp} label="Today" value={data.today_requests ?? 0} index={1} />
        <MetricCard icon={PieChart} label="Features Used" value={featureCounts.length} index={2} />
        <MetricCard icon={BarChart3} label="Avg / Day" value={data.avg_per_day ?? 0} index={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart — daily usage */}
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary-400" /> Daily Usage
          </h3>
          {dailyCounts.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dailyCounts}>
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#e2e8f0' }}
                />
                <Bar dataKey="count" fill="#6c5ce7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-surface-500 text-center py-12">No daily data yet</p>
          )}
        </Card>

        {/* Pie chart — feature usage */}
        <Card>
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-primary-400" /> Feature Breakdown
          </h3>
          {featureCounts.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <RPieChart>
                <Pie data={featureCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {featureCounts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              </RPieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-surface-500 text-center py-12">No feature data yet</p>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
