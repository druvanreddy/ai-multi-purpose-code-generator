import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, FileBarChart, Download, RefreshCw, X, GripVertical,
  Plus, Trash2, ChevronDown, ChevronUp, Copy, Edit,
} from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ResultCard from '../components/ui/ResultCard';
import { api } from '../utils/api';
import { useSettings } from '../hooks/useSettings';
import { downloadBlob } from '../utils/helpers';
import toast from 'react-hot-toast';
import { marked } from 'marked';

const REPORT_TYPES = [
  'Technical Report', 'Research Paper', 'Thesis', 'Business Report',
  'Case Study', 'White Paper', 'Literature Review', 'Project Report',
  'Feasibility Study', 'Annual Report', 'Proposal', 'Dissertation',
];

const WORD_COUNTS = [
  { label: '3,000', value: 3000 },
  { label: '5,000', value: 5000 },
  { label: '10,000', value: 10000 },
  { label: '25,000', value: 25000 },
];

export default function ReportGenerator() {
  const { settings } = useSettings();
  const [screen, setScreen] = useState('settings');

  const [topic, setTopic] = useState('');
  const [reportType, setReportType] = useState('Technical Report');
  const [template, setTemplate] = useState('academic');
  const [wordCount, setWordCount] = useState(3000);
  const [language, setLanguage] = useState('English');
  const [style, setStyle] = useState('Professional');
  const [citationStyle, setCitationStyle] = useState('IEEE');

  const [chapters, setChapters] = useState([]);
  const [chapterContents, setChapterContents] = useState({});
  const [references, setReferences] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [loading, setLoading] = useState(false);

  const generateToc = async () => {
    if (!topic.trim()) return toast.error('Enter a topic');
    setLoading(true);
    try {
      const res = await api.reportToc({ topic, report_type: reportType, template, model: settings.model });
      setChapters(res.chapters);
      setScreen('toc');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateFull = async () => {
    setScreen('progress');
    setProgress(0);
    const total = chapters.length + 1;
    const contents = {};
    let citationStart = 1;
    let prevContext = '';

    for (let i = 0; i < chapters.length; i++) {
      setProgressText(`Writing: ${chapters[i]}`);
      setProgress(Math.round(((i) / total) * 100));
      try {
        const res = await api.reportChapter({
          topic, report_type: reportType, chapter_title: chapters[i],
          chapter_number: i + 1, total_chapters: chapters.length,
          word_target: Math.round(wordCount / chapters.length),
          language, style, citation_style: citationStyle,
          previous_context: prevContext.slice(-2000),
          citation_start: citationStart,
          model: settings.model, temperature: settings.temperature, max_tokens: settings.maxTokens,
        });
        contents[i] = res.result;
        prevContext += res.result;
        const citations = (res.result.match(/\[(\d+)\]/g) || []).map((m) => parseInt(m.slice(1, -1)));
        if (citations.length) citationStart = Math.max(...citations) + 1;
      } catch (err) {
        contents[i] = `*Error generating this chapter: ${err.message}*`;
      }
    }

    setProgressText('Generating references…');
    setProgress(Math.round(((chapters.length) / total) * 100));
    try {
      const combined = Object.values(contents).join('\n\n');
      const res = await api.reportReferences({ combined_text: combined, citation_style: citationStyle, model: settings.model });
      setReferences(res.result);
    } catch {
      setReferences('');
    }

    setChapterContents(contents);
    setProgress(100);
    setScreen('results');
  };

  const exportReport = async (format) => {
    const body = {
      title: topic,
      chapters: chapters.map((c, i) => ({ title: c, content: chapterContents[i] || '' })),
      references,
    };
    try {
      const res = await api.reportExport(format, body);
      await downloadBlob(res, `${topic.replace(/[^a-zA-Z0-9]/g, '_')}.${format === 'markdown' ? 'md' : format}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <PageWrapper title="Report Generator" subtitle="Generate professional, editable reports from a single topic">
      <AnimatePresence mode="wait">
        {/* SETTINGS SCREEN */}
        {screen === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="glass-card p-5 space-y-4">
              <label className="block text-xs font-medium text-surface-400">
                Report Topic
                <input className="input-field mt-1.5" placeholder="e.g. AI in Healthcare" value={topic} onChange={(e) => setTopic(e.target.value)} />
              </label>

              <div>
                <span className="block text-xs font-medium text-surface-400 mb-2">Report Type</span>
                <div className="flex flex-wrap gap-2">
                  {REPORT_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => setReportType(t)} className={`chip ${reportType === t ? 'chip-active' : ''}`}>{t}</button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-surface-400 mb-2">Template</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { val: 'academic', title: 'Academic Style', desc: 'Cover, Certificate, Declaration, Abstract, Chapters, References, Appendix' },
                    { val: 'industry', title: 'Industry Style', desc: 'Executive Summary, Objectives, Methodology, Implementation, Results, Conclusion' },
                  ].map((t) => (
                    <button
                      key={t.val}
                      onClick={() => setTemplate(t.val)}
                      className={`text-left p-4 rounded-xl border transition-all ${template === t.val ? 'border-primary-500/40 bg-primary-500/10' : 'border-white/[0.06] bg-surface-800/40 hover:border-white/[0.12]'}`}
                    >
                      <p className="text-sm font-medium text-white">{t.title}</p>
                      <p className="text-xs text-surface-400 mt-1">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium text-surface-400 mb-2">Word Count</span>
                  <div className="flex flex-wrap gap-2">
                    {WORD_COUNTS.map((w) => (
                      <button key={w.value} onClick={() => setWordCount(w.value)} className={`chip ${wordCount === w.value ? 'chip-active' : ''}`}>{w.label}</button>
                    ))}
                  </div>
                </div>
                <label className="block text-xs font-medium text-surface-400">
                  Language
                  <select className="select-field mt-1.5" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {['English', 'Spanish', 'French', 'German', 'Portuguese', 'Hindi', 'Telugu', 'Japanese', 'Chinese'].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs font-medium text-surface-400">
                  Writing Style
                  <select className="select-field mt-1.5" value={style} onChange={(e) => setStyle(e.target.value)}>
                    {['Professional', 'Academic', 'Formal', 'Technical', 'Business', 'Simple', 'Humanized', 'Research', 'Journal Style'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-medium text-surface-400">
                  Citation Style
                  <select className="select-field mt-1.5" value={citationStyle} onChange={(e) => setCitationStyle(e.target.value)}>
                    {['IEEE', 'APA', 'Harvard', 'MLA', 'Chicago'].map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </div>

              <button onClick={generateToc} disabled={loading} className="btn-primary w-full justify-center">
                <Zap size={16} />
                {loading ? 'Generating…' : 'Generate Table of Contents'}
              </button>
            </div>
            {loading && <LoadingSpinner text="Generating table of contents…" />}
          </motion.div>
        )}

        {/* TOC SCREEN */}
        {screen === 'toc' && (
          <motion.div key="toc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <FileBarChart size={16} className="text-primary-400" /> Table of Contents
                </h3>
              </div>
              <div className="space-y-2">
                {chapters.map((ch, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-800/40 border border-white/[0.04] group"
                  >
                    <GripVertical size={14} className="text-surface-600 shrink-0" />
                    <span className="text-xs font-medium text-surface-500 w-6">{i + 1}.</span>
                    <input
                      className="flex-1 text-sm text-surface-200 bg-transparent border-none outline-none"
                      value={ch}
                      onChange={(e) => {
                        const copy = [...chapters];
                        copy[i] = e.target.value;
                        setChapters(copy);
                      }}
                    />
                    <button
                      onClick={() => setChapters(chapters.filter((_, j) => j !== i))}
                      className="opacity-0 group-hover:opacity-100 text-surface-500 hover:text-danger transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
              <button
                onClick={() => setChapters([...chapters, 'New Chapter'])}
                className="btn-ghost mt-3 text-xs"
              >
                <Plus size={14} /> Add Chapter
              </button>
            </Card>
            <div className="flex gap-3">
              <button onClick={() => setScreen('settings')} className="btn-ghost">Back</button>
              <button onClick={generateFull} className="btn-primary flex-1 justify-center">
                <Zap size={16} /> Generate Full Report
              </button>
            </div>
          </motion.div>
        )}

        {/* PROGRESS SCREEN */}
        {screen === 'progress' && (
          <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Card>
              <div className="text-center space-y-4">
                <p className="text-sm text-surface-300">{progressText}</p>
                <div className="w-full bg-surface-800 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <p className="text-lg font-bold text-white">{progress}%</p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* RESULTS SCREEN */}
        {screen === 'results' && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <Card>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">
                  <FileBarChart size={16} className="inline text-primary-400 mr-2" />
                  {topic}
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => exportReport('docx')} className="btn-primary !text-xs !px-3 !py-1.5"><Download size={14} /> DOCX</button>
                  <button onClick={() => exportReport('pdf')} className="btn-primary !text-xs !px-3 !py-1.5"><Download size={14} /> PDF</button>
                  <button onClick={() => exportReport('markdown')} className="btn-primary !text-xs !px-3 !py-1.5"><Download size={14} /> Markdown</button>
                  <button onClick={() => { setScreen('settings'); setChapterContents({}); setReferences(''); }} className="btn-ghost !text-xs"><X size={14} /> Start Over</button>
                </div>
              </div>
            </Card>

            {chapters.map((ch, i) => (
              <ResultCard key={i} title={`${i + 1}. ${ch}`} result={chapterContents[i] || ''} show={!!chapterContents[i]} />
            ))}

            {references && (
              <ResultCard title="References" result={references} show={true} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}
