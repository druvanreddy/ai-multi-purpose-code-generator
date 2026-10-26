import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileText, Bug, Zap, BookOpen, Shield, BarChart3, Eye,
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Tabs from '../components/ui/Tabs';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ResultCard from '../components/ui/ResultCard';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const ACTIONS = [
  { key: 'explain', label: 'Explain', icon: Eye },
  { key: 'debug', label: 'Debug', icon: Bug },
  { key: 'optimize', label: 'Optimize', icon: Zap },
  { key: 'docs', label: 'Docs', icon: BookOpen },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'complexity', label: 'Complexity', icon: BarChart3 },
];

export default function FileAnalyzer() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [action, setAction] = useState('explain');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const inputRef = useRef();
  const dropRef = useRef();

  const handleFile = (f) => {
    setFile(f);
    setResults({});
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsText(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    dropRef.current?.classList.remove('border-primary-500/50');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const analyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('action', action);
      fd.append('file', file);
      const res = await api.fileAnalyze(fd);
      const data = await res.json();
      setResults((prev) => ({ ...prev, [action]: data.result }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageWrapper title="File Analyzer" subtitle="Upload files and analyze them using AI">
      {/* Dropzone */}
      <div
        ref={dropRef}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add('border-primary-500/50'); }}
        onDragLeave={() => dropRef.current?.classList.remove('border-primary-500/50')}
        className="glass-card p-8 border-2 border-dashed border-white/[0.08] hover:border-primary-500/30 transition-colors cursor-pointer flex flex-col items-center gap-3"
      >
        <input ref={inputRef} type="file" hidden onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])} />
        <div className="p-3 rounded-2xl bg-primary-500/10">
          <Upload size={24} className="text-primary-400" />
        </div>
        <p className="text-sm text-surface-300">
          Drop a file here or <span className="text-primary-400 font-medium">browse</span>
        </p>
        <p className="text-xs text-surface-500">py, java, js/ts, go, rs, rb, kt, swift, php, sql, sh, and 20+ more…</p>
      </div>

      {file && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-surface-400 flex items-center gap-2">
          <FileText size={14} className="text-primary-400" />
          {file.name} <span className="text-surface-600">({(file.size / 1024).toFixed(1)} KB)</span>
        </motion.div>
      )}

      {/* Preview */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="glass-card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.04]">
              <h3 className="text-sm font-semibold text-white">File Preview</h3>
            </div>
            <pre className="p-5 text-xs text-surface-300 overflow-x-auto max-h-[300px] overflow-y-auto font-mono">{preview.slice(0, 5000)}</pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis tabs */}
      {file && (
        <>
          <Tabs tabs={ACTIONS} active={action} onChange={setAction} />
          <button onClick={analyze} disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Analyzing…' : `Analyze: ${ACTIONS.find((a) => a.key === action)?.label}`}
          </button>

          {loading && <LoadingSpinner text="Analyzing file…" />}

          <ResultCard
            title={`${ACTIONS.find((a) => a.key === action)?.label} Report`}
            result={results[action] || ''}
            show={!!results[action] && !loading}
          />
        </>
      )}
    </PageWrapper>
  );
}
