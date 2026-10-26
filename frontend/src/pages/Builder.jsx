import { useState } from 'react';
import {
  FolderOpen, Globe, Database, Server, Container,
  FileCode, FileText, BookOpen, TestTubes, Zap, Download,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PageWrapper from '../components/layout/PageWrapper';
import Tabs from '../components/ui/Tabs';
import CodeForm from '../components/shared/CodeForm';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { useSettings } from '../hooks/useSettings';

const TABS = [
  { key: 'project', label: 'Project', icon: FolderOpen },
  { key: 'api', label: 'API', icon: Globe },
  { key: 'database', label: 'Database', icon: Database },
  { key: 'architecture', label: 'Architecture', icon: Server },
  { key: 'docker', label: 'Docker', icon: Container },
  { key: 'sql', label: 'SQL', icon: FileCode },
  { key: 'readme', label: 'README', icon: FileText },
  { key: 'docs', label: 'Docs', icon: BookOpen },
  { key: 'tests', label: 'Tests', icon: TestTubes },
];

function ProjectTab() {
  const { settings } = useSettings();
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const set = (k, v) => setValues((p) => ({ ...p, [k]: v }));

  const generate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.projectGenerate({
        name: values.name || 'my-project',
        language: values.language || 'Python',
        framework: values.framework || '',
        description: values.description,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      });
      setResult(res.result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadZip = async () => {
    try {
      const res = await api.projectZip({ content: result, project_name: values.name || 'project' });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${values.name || 'project'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={generate} className="glass-card p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-xs font-medium text-surface-400">
            Language
            <select className="select-field mt-1.5" value={values.language || 'Python'} onChange={(e) => set('language', e.target.value)}>
              <option>Python</option><option>Java</option><option>JavaScript</option><option>TypeScript</option><option>C++</option><option>C#</option><option>Go</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-surface-400">
            Framework
            <input className="input-field mt-1.5" placeholder="FastAPI, Flask, Django, React…" value={values.framework || ''} onChange={(e) => set('framework', e.target.value)} />
          </label>
        </div>
        <label className="block text-xs font-medium text-surface-400">
          Project Name
          <input className="input-field mt-1.5" value={values.name || ''} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label className="block text-xs font-medium text-surface-400">
          Project Description
          <textarea className="textarea-field mt-1.5" rows={8} value={values.description || ''} onChange={(e) => set('description', e.target.value)} required />
        </label>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          <Zap size={16} />
          {loading ? 'Generating…' : 'Generate Project'}
        </button>
      </form>

      {result && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white">Generated Project</h3>
            <button onClick={downloadZip} className="btn-primary !text-xs !px-3 !py-1.5">
              <Download size={14} /> Download ZIP
            </button>
          </div>
          <div className="p-5">
            <div
              className="prose prose-invert prose-sm max-w-none prose-pre:bg-surface-800/80 prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl prose-code:text-primary-300"
              dangerouslySetInnerHTML={{ __html: (async () => { const { marked } = await import('marked'); return marked.parse(result); })() || result }}
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function Builder() {
  const [tab, setTab] = useState('project');

  return (
    <PageWrapper title="Project Builder" subtitle="Scaffold projects, SQL, docs, and tests">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'project' && <ProjectTab />}

          {tab === 'api' && (
            <CodeForm
              apiCall={(body) => api.projectApi({ language: body.language || 'Python', framework: body.framework || '', description: body.description, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="API Generator"
              resultTitle="API Design"
              buttonLabel="Generate API"
              buttonIcon={Globe}
              fields={[
                { key: 'language', type: 'select', label: 'Language', options: ['Python', 'Java', 'JavaScript', 'TypeScript', 'Go', 'C#'] },
                { key: 'framework', type: 'text', label: 'Framework', placeholder: 'FastAPI, Express, Spring Boot…' },
                { key: 'description', type: 'textarea', label: 'Describe the API', rows: 10, placeholder: 'A REST API for a task manager: users, tasks, projects, with auth…' },
              ]}
            />
          )}

          {tab === 'database' && (
            <CodeForm
              apiCall={(body) => api.projectDatabase({ description: body.description, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Database Designer"
              resultTitle="Data Model"
              buttonLabel="Design Data Model"
              buttonIcon={Database}
              fields={[
                { key: 'description', type: 'textarea', label: 'Describe your data', rows: 10, placeholder: 'An e-commerce store: customers, orders, products, reviews…' },
              ]}
            />
          )}

          {tab === 'architecture' && (
            <CodeForm
              apiCall={(body) => api.projectArchitecture({ description: body.description, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Architecture Designer"
              resultTitle="Architecture"
              buttonLabel="Design Architecture"
              buttonIcon={Server}
              fields={[
                { key: 'description', type: 'textarea', label: 'Describe the system', rows: 10, placeholder: 'A real-time chat app supporting 10k concurrent users…' },
              ]}
            />
          )}

          {tab === 'docker' && (
            <CodeForm
              apiCall={(body) => api.projectDocker({ description: body.description, language: body.language || '', framework: body.framework || '', model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Docker Generator"
              resultTitle="Docker Configuration"
              buttonLabel="Generate Docker Config"
              buttonIcon={Container}
              fields={[
                { key: 'language', type: 'text', label: 'Language', placeholder: 'Python, Node.js, Go…' },
                { key: 'framework', type: 'text', label: 'Framework', placeholder: 'FastAPI, Express…' },
                { key: 'description', type: 'textarea', label: 'Describe the service', rows: 8, placeholder: 'A FastAPI web service with a PostgreSQL database and Redis cache…' },
              ]}
            />
          )}

          {tab === 'sql' && (
            <CodeForm
              apiCall={(body) => api.projectSql({ description: body.description, dialect: body.dialect || 'PostgreSQL', model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="SQL Generator"
              resultTitle="Generated SQL"
              buttonLabel="Generate SQL"
              buttonIcon={FileCode}
              isMarkdown={false}
              fields={[
                { key: 'dialect', type: 'select', label: 'SQL Dialect', options: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server'] },
                { key: 'description', type: 'textarea', label: 'Describe your database', rows: 10 },
              ]}
            />
          )}

          {tab === 'readme' && (
            <CodeForm
              apiCall={(body) => api.projectReadme({ details: body.details, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="README Generator"
              resultTitle="README.md"
              buttonLabel="Generate README"
              buttonIcon={FileText}
              fields={[
                { key: 'details', type: 'textarea', label: 'Project Details', rows: 10 },
              ]}
            />
          )}

          {tab === 'docs' && (
            <CodeForm
              apiCall={(body) => api.projectDocs({ details: body.details, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Documentation Generator"
              resultTitle="Documentation"
              buttonLabel="Generate Documentation"
              buttonIcon={BookOpen}
              fields={[
                { key: 'details', type: 'textarea', label: 'Describe your project', rows: 10 },
              ]}
            />
          )}

          {tab === 'tests' && (
            <CodeForm
              apiCall={(body) => api.projectTests({ language: body.language || 'Python', code: body.code, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Unit Test Generator"
              resultTitle="Unit Tests"
              buttonLabel="Generate Unit Tests"
              buttonIcon={TestTubes}
              isMarkdown={false}
              fields={[
                { key: 'language', type: 'select', label: 'Language', options: ['Python', 'Java', 'JavaScript', 'C++'] },
                { key: 'code', type: 'textarea', label: 'Paste your code', rows: 10 },
              ]}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </PageWrapper>
  );
}
