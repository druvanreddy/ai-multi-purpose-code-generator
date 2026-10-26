import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, Trash2, Inbox } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import { api } from '../utils/api';
import { downloadBlob } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function History() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getHistory();
      setRows(data.history);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) => r.feature.toLowerCase().includes(q) || r.prompt.toLowerCase().includes(q) || r.response.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const clearAll = async () => {
    try {
      await api.clearHistory();
      setRows([]);
      toast.success('History cleared');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const exportCsv = async () => {
    try {
      const res = await api.exportHistory();
      await downloadBlob(res, 'history.csv');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <PageWrapper
      title="History"
      subtitle="View all your AI activities"
      actions={
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            className="input-field !pl-9 !py-2 !text-xs w-64"
            placeholder="Search history…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      }
    >
      <Card>
        {filtered.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Inbox size={32} className="text-surface-600" />
            <p className="text-sm text-surface-500">No history yet — generate something and it'll show up here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-3 px-3 text-surface-500 font-medium">#</th>
                  <th className="text-left py-3 px-3 text-surface-500 font-medium">Feature</th>
                  <th className="text-left py-3 px-3 text-surface-500 font-medium">Prompt</th>
                  <th className="text-left py-3 px-3 text-surface-500 font-medium">Response</th>
                  <th className="text-left py-3 px-3 text-surface-500 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 px-3 text-surface-500">{r.id}</td>
                    <td className="py-3 px-3">
                      <span className="chip chip-active !text-[10px] !px-2 !py-0.5">{r.feature}</span>
                    </td>
                    <td className="py-3 px-3 text-surface-300 max-w-[200px] truncate">{r.prompt}</td>
                    <td className="py-3 px-3 text-surface-400 max-w-[250px] truncate">{r.response}</td>
                    <td className="py-3 px-3 text-surface-500 whitespace-nowrap">{r.created_at}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        <button onClick={exportCsv} className="btn-ghost"><Download size={15} /> Export CSV</button>
        <button onClick={clearAll} className="btn-danger"><Trash2 size={15} /> Clear History</button>
      </div>
    </PageWrapper>
  );
}
