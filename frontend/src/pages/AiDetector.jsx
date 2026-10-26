import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Shield, Sparkles, Wand2, Download, X,
  BarChart3, FileText, Eye, RefreshCw, Check, Clock, Trash2, ChevronRight,
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ResultCard from '../components/ui/ResultCard';
import { api } from '../utils/api';
import { useSettings } from '../hooks/useSettings';
import { downloadBlob, copyToClipboard } from '../utils/helpers';
import toast from 'react-hot-toast';

function GaugeRing({ percent }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 65 ? '#ef4444' : percent >= 35 ? '#f59e0b' : '#10b981';

  return (
    <div className="relative w-36 h-36">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{percent}%</span>
        <span className="text-[10px] text-surface-400">AI Likelihood</span>
      </div>
    </div>
  );
}

export default function AiDetector() {
  const { settings } = useSettings();
  const [screen, setScreen] = useState('upload');
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [insights, setInsights] = useState('');
  const [humanized, setHumanized] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [humanizeLoading, setHumanizeLoading] = useState(false);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const inputRef = useRef();

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getDetectorHistory();
      setHistory(res.history || []);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { loadHistory(); }, []);

  const deleteEntry = async (id) => {
    try {
      await api.deleteDetectorEntry(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success('Entry deleted');
    } catch (err) { toast.error(err.message); }
  };

  const clearAllHistory = async () => {
    try {
      await api.clearDetectorHistory();
      setHistory([]);
      toast.success('History cleared');
    } catch (err) { toast.error(err.message); }
  };

  const viewEntry = async (id) => {
    try {
      const res = await api.getDetectorEntry(id);
      setAnalysis(res.analysis);
      setText('');
      setScreen('results');
    } catch (err) { toast.error(err.message); }
  };

  const analyzeText = async () => {
    if (!textInput.trim()) return toast.error('Enter or upload text');
    setLoading(true);
    try {
      const res = await api.detectAnalyzeText({ text: textInput });
      setText(res.text);
      setAnalysis(res.analysis);
      setScreen('results');
      loadHistory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const analyzeFile = async (f) => {
    setFile(f);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.detectAnalyzeFile(fd);
      const data = await res.json();
      setText(data.text);
      setAnalysis(data.analysis);
      setScreen('results');
      loadHistory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await api.detectInsights({
        text, analysis,
        model: settings.model, temperature: settings.temperature, max_tokens: settings.maxTokens,
      });
      setInsights(res.result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setInsightsLoading(false);
    }
  };

  const humanize = async () => {
    setHumanizeLoading(true);
    try {
      const res = await api.detectHumanize({
        text,
        model: settings.model, temperature: settings.temperature, max_tokens: settings.maxTokens,
      });
      setHumanized(res.result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setHumanizeLoading(false);
    }
  };

  const exportReport = async (format) => {
    try {
      const res = await api.detectExport(format, {
        filename: file?.name || 'document-analysis',
        text, analysis, insights,
      });
      await downloadBlob(res, `document-analysis.${format === 'markdown' ? 'md' : format}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startOver = () => {
    setScreen('upload');
    setTextInput('');
    setFile(null);
    setText('');
    setAnalysis(null);
    setInsights('');
    setHumanized('');
  };

  const ai = analysis?.ai_likelihood;
  const stats = analysis?.stats;
  const readability = analysis?.readability;
  const stylo = analysis?.stylometry;

  return (
    <PageWrapper
      title="AI Detector"
      subtitle="Estimated AI-writing likelihood and document quality — a transparent statistical heuristic"
    >
      <AnimatePresence mode="wait">
        {/* UPLOAD SCREEN */}
        {screen === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) analyzeFile(e.dataTransfer.files[0]); }}
              onDragOver={(e) => e.preventDefault()}
              className="glass-card p-8 border-2 border-dashed border-white/[0.08] hover:border-primary-500/30 transition-colors cursor-pointer flex flex-col items-center gap-3"
            >
              <input ref={inputRef} type="file" hidden accept=".txt,.md,.markdown,.html,.htm,.docx,.pdf" onChange={(e) => e.target.files[0] && analyzeFile(e.target.files[0])} />
              <div className="p-3 rounded-2xl bg-primary-500/10"><Upload size={24} className="text-primary-400" /></div>
              <p className="text-sm text-surface-300">Drop a document or <span className="text-primary-400 font-medium">browse</span></p>
              <p className="text-xs text-surface-500">txt, md, html, docx, pdf</p>
            </div>

            <div className="glass-card p-5 space-y-4">
              <label className="block text-xs font-medium text-surface-400">
                Or paste text directly
                <textarea className="textarea-field mt-1.5" rows={12} placeholder="Paste the text you want to analyze…" value={textInput} onChange={(e) => setTextInput(e.target.value)} />
              </label>
              <button onClick={analyzeText} disabled={loading} className="btn-primary w-full justify-center">
                <Shield size={16} /> {loading ? 'Analyzing…' : 'Analyze Document'}
              </button>
            </div>
            {loading && <LoadingSpinner text="Analyzing document…" />}
          </motion.div>
        )}

        {/* RESULTS SCREEN */}
        {screen === 'results' && analysis && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Overview */}
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Shield size={16} className="text-primary-400" /> Analysis</h3>
                <button onClick={startOver} className="btn-ghost !text-xs"><X size={14} /> New Analysis</button>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <GaugeRing percent={ai?.estimated_ai_probability || 0} />
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Band', value: ai?.band },
                    { label: 'Confidence', value: ai?.confidence },
                    { label: 'Words', value: stats?.word_count?.toLocaleString() },
                    { label: 'Reading Time', value: `${stats?.reading_time_minutes} min` },
                    { label: 'Flesch Score', value: readability?.flesch_reading_ease },
                    { label: 'Grade Level', value: readability?.flesch_kincaid_grade },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-[10px] text-surface-500 uppercase tracking-wider">{m.label}</p>
                      <p className="text-sm font-semibold text-white mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-surface-500 mt-4 p-3 rounded-xl bg-surface-800/40 border border-white/[0.04]">
                This analysis estimates the likelihood of AI-assisted writing using statistical signals. Results are probabilistic and should not be treated as proof.
              </p>
            </Card>

            {/* Contributing Factors */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-primary-400" /> Contributing Factors</h3>
              <div className="space-y-3">
                {ai?.contributing_factors?.map((f, i) => (
                  <motion.div key={f.signal} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-surface-300">{f.signal}</span>
                      <span className="text-surface-500">{(f.strength * 100).toFixed(0)}% × {f.weight}</span>
                    </div>
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${f.strength * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            </Card>

            {/* Readability */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">Readability Indices</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Flesch Reading Ease', value: readability?.flesch_reading_ease },
                  { label: 'Flesch-Kincaid Grade', value: readability?.flesch_kincaid_grade },
                  { label: 'Gunning Fog', value: readability?.gunning_fog_index },
                  { label: 'SMOG Index', value: readability?.smog_index },
                  { label: 'Coleman-Liau', value: readability?.coleman_liau_index },
                  { label: 'ARI', value: readability?.automated_readability_index },
                ].map((m) => (
                  <div key={m.label} className="p-3 rounded-xl bg-surface-800/40 border border-white/[0.04]">
                    <p className="text-[10px] text-surface-500">{m.label}</p>
                    <p className="text-sm font-bold text-white mt-1">{m.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Stylometry */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3">Stylometric Analysis</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Burstiness (CV)', value: stylo?.burstiness_cv },
                  { label: 'Vocabulary Richness', value: stylo?.type_token_ratio },
                  { label: 'Lexical Density', value: stylo?.lexical_density },
                  { label: 'Passive Voice', value: stylo?.passive_voice_ratio },
                  { label: 'Repetition Ratio', value: stylo?.repetition_ratio },
                  { label: 'Transition Diversity', value: stylo?.transition_diversity },
                  { label: 'Contraction Ratio', value: stylo?.contraction_ratio },
                  { label: 'Hapax Legomena', value: stylo?.hapax_ratio },
                  { label: 'AI Phrase Density', value: stylo?.ai_phrase_density },
                  { label: 'Consecutive Similar', value: stylo?.consecutive_similar_ratio },
                  { label: 'Opener Diversity', value: stylo?.opener_diversity },
                  { label: 'Filler Word Ratio', value: stylo?.filler_ratio },
                ].map((m) => (
                  <div key={m.label} className="p-3 rounded-xl bg-surface-800/40 border border-white/[0.04]">
                    <p className="text-[10px] text-surface-500">{m.label}</p>
                    <p className="text-sm font-bold text-white mt-1">{m.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* AI Insights */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Sparkles size={16} className="text-primary-400" /> AI-Generated Insights</h3>
              {!insights && !insightsLoading && (
                <button onClick={getInsights} className="btn-primary w-full justify-center"><Sparkles size={16} /> Get AI Insights & Recommendations</button>
              )}
              {insightsLoading && <LoadingSpinner text="Generating insights…" />}
              <ResultCard title="Insights" result={insights} show={!!insights && !insightsLoading} />
            </Card>

            {/* Humanize */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Wand2 size={16} className="text-primary-400" /> Humanize / Reduce AI Signals</h3>
              <p className="text-xs text-surface-500 mb-3">Rewrites text to vary sentence structure and diversify vocabulary — a style-naturalization pass.</p>
              {!humanized && !humanizeLoading && (
                <button onClick={humanize} className="btn-primary w-full justify-center"><Wand2 size={16} /> Humanize This Text</button>
              )}
              {humanizeLoading && <LoadingSpinner text="Humanizing…" />}
              <ResultCard title="Humanized Text" result={humanized} show={!!humanized && !humanizeLoading} />
            </Card>

            {/* Export */}
            <Card>
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Download size={16} /> Export Report</h3>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => exportReport('docx')} className="btn-primary !text-xs !px-3 !py-1.5"><Download size={14} /> DOCX</button>
                <button onClick={() => exportReport('pdf')} className="btn-primary !text-xs !px-3 !py-1.5"><Download size={14} /> PDF</button>
                <button onClick={() => exportReport('markdown')} className="btn-primary !text-xs !px-3 !py-1.5"><Download size={14} /> Markdown</button>
                <button onClick={() => exportReport('json')} className="btn-ghost !text-xs"><Download size={14} /> JSON</button>
                <button onClick={() => exportReport('csv')} className="btn-ghost !text-xs"><Download size={14} /> CSV</button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DETECTION HISTORY */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-primary-400" /> Detection History
          </h3>
          <div className="flex gap-2">
            <button onClick={loadHistory} className="btn-ghost !text-xs !px-2 !py-1"><RefreshCw size={12} /></button>
            {history.length > 0 && (
              <button onClick={clearAllHistory} className="btn-danger !text-xs !px-2 !py-1"><Trash2 size={12} /> Clear</button>
            )}
          </div>
        </div>

        {historyLoading && <LoadingSpinner text="Loading history…" />}

        {!historyLoading && history.length === 0 && (
          <p className="text-xs text-surface-500 text-center py-8">No detection history yet — analyze a document to get started.</p>
        )}

        {!historyLoading && history.length > 0 && (
          <div className="space-y-2">
            {history.map((h, i) => {
              const pct = h.ai_probability;
              const color = pct >= 65 ? 'text-red-400' : pct >= 35 ? 'text-yellow-400' : 'text-green-400';
              const barColor = pct >= 65 ? 'bg-red-500' : pct >= 35 ? 'bg-yellow-500' : 'bg-green-500';
              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-4 p-3 rounded-xl bg-surface-800/40 border border-white/[0.04] hover:border-white/[0.08] transition-all group"
                >
                  {/* AI score gauge */}
                  <div className="w-12 text-center shrink-0">
                    <span className={`text-lg font-bold ${color}`}>{pct}%</span>
                  </div>

                  {/* Mini progress bar */}
                  <div className="w-16 shrink-0">
                    <div className="h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[9px] text-surface-500 mt-0.5 text-center">{h.band}</p>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white truncate">{h.filename}</span>
                      <span className="text-[10px] text-surface-500">{h.word_count} words</span>
                    </div>
                    <p className="text-[10px] text-surface-500 truncate mt-0.5">{h.text_preview}</p>
                  </div>

                  {/* Metrics chips */}
                  <div className="hidden lg:flex items-center gap-2 shrink-0">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-surface-400" title="Burstiness">B:{h.burstiness_cv}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-surface-400" title="Vocabulary">V:{h.type_token_ratio}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-surface-400" title="Contractions">C:{h.contraction_ratio}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-surface-400" title="Hapax">H:{h.hapax_ratio}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-surface-400" title="Flesch">F:{h.flesch_reading_ease}</span>
                  </div>

                  {/* Date */}
                  <span className="text-[10px] text-surface-500 whitespace-nowrap shrink-0">{h.created_at}</span>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => viewEntry(h.id)} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-400 hover:text-white transition-colors" title="View full analysis">
                      <ChevronRight size={14} />
                    </button>
                    <button onClick={() => deleteEntry(h.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>
    </PageWrapper>
  );
}
