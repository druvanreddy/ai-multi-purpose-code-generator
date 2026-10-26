import { useState } from 'react';
import {
  MessageSquare, Code, Bug, BookOpen, Zap, Eye,
  Shield, FileText, GitCommit,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PageWrapper from '../components/layout/PageWrapper';
import Tabs from '../components/ui/Tabs';
import ChatPanel from '../components/shared/ChatPanel';
import CodeForm from '../components/shared/CodeForm';
import { api } from '../utils/api';
import { LANGUAGES, PROJECT_TYPES } from '../utils/helpers';

const TABS = [
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'generate', label: 'Code Generator', icon: Code },
  { key: 'debug', label: 'Debugger', icon: Bug },
  { key: 'explain', label: 'Explainer', icon: BookOpen },
  { key: 'optimize', label: 'Optimizer', icon: Zap },
  { key: 'review', label: 'Reviewer', icon: Eye },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'document', label: 'Documentation', icon: FileText },
  { key: 'commit', label: 'Commit', icon: GitCommit },
];

export default function Assistant() {
  const [tab, setTab] = useState('chat');

  return (
    <PageWrapper title="AI Assistant" subtitle="Your intelligent coding companion">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'chat' && <ChatPanel />}

          {tab === 'generate' && (
            <CodeForm
              apiCall={(body) => api.codeGenerate({
                language: body.language || 'Python',
                framework: body.framework || '',
                project_type: body.project_type || 'Web Application',
                task: body.task,
                include_tests: body.include_tests || false,
                model: body.model,
                temperature: body.temperature,
                max_tokens: body.max_tokens,
              })}
              title="Code Generator"
              resultTitle="Generated Code"
              buttonLabel="Generate Code"
              buttonIcon={Zap}
              filename="generated-code.txt"
              fields={[
                { key: 'language', type: 'select-language', label: 'Programming Language' },
                { key: 'framework', type: 'text', label: 'Framework (optional)', placeholder: 'Django, React, Flask, FastAPI…' },
                { key: 'project_type', type: 'select', label: 'Project Type', options: PROJECT_TYPES },
                { key: 'task', type: 'textarea', label: 'Describe what you want to build', rows: 8, placeholder: 'Create a REST API using FastAPI for Student Management with CRUD operations…' },
                { key: 'include_tests', type: 'checkbox', label: 'Include unit tests alongside the code' },
              ]}
            />
          )}

          {tab === 'debug' && (
            <CodeForm
              apiCall={(body) => api.codeDebug({ language: body.language || 'Python', code: body.code, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Debugger"
              resultTitle="Debug Report"
              buttonLabel="Debug Code"
              buttonIcon={Bug}
              fields={[
                { key: 'language', type: 'select-language', label: 'Programming Language' },
                { key: 'code', type: 'textarea', label: 'Paste your code', rows: 12 },
              ]}
            />
          )}

          {tab === 'explain' && (
            <CodeForm
              apiCall={(body) => api.codeExplain({ level: body.level || 'Intermediate', code: body.code, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Explainer"
              resultTitle="Explanation"
              buttonLabel="Explain Code"
              buttonIcon={BookOpen}
              fields={[
                { key: 'level', type: 'select', label: 'Explanation Level', options: ['Beginner', 'Intermediate', 'Advanced'] },
                { key: 'code', type: 'textarea', label: 'Paste code to explain', rows: 12 },
              ]}
            />
          )}

          {tab === 'optimize' && (
            <CodeForm
              apiCall={(body) => api.codeOptimize({ code: body.code, goals: body.goals || ['Performance', 'Readability'], model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Optimizer"
              resultTitle="Optimized Result"
              buttonLabel="Optimize Code"
              buttonIcon={Zap}
              fields={[
                { key: 'code', type: 'textarea', label: 'Paste code to optimize', rows: 12 },
                { key: 'goals', type: 'chips', label: 'Optimization Goals', options: ['Performance', 'Readability', 'Maintainability', 'Memory Usage', 'Best Practices', 'Security'], defaults: ['Performance', 'Readability'] },
              ]}
            />
          )}

          {tab === 'review' && (
            <CodeForm
              apiCall={(body) => api.codeReview({ language: body.language || 'Python', code: body.code, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Code Reviewer"
              resultTitle="Code Review"
              buttonLabel="Review Code"
              buttonIcon={Eye}
              fields={[
                { key: 'language', type: 'select-language', label: 'Programming Language' },
                { key: 'code', type: 'textarea', label: 'Paste your code', rows: 12 },
              ]}
            />
          )}

          {tab === 'security' && (
            <CodeForm
              apiCall={(body) => api.codeSecurity({ language: body.language || 'Python', code: body.code, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Security Scanner"
              resultTitle="Security Report"
              buttonLabel="Scan for Vulnerabilities"
              buttonIcon={Shield}
              fields={[
                { key: 'language', type: 'select-language', label: 'Programming Language' },
                { key: 'code', type: 'textarea', label: 'Paste your code', rows: 12 },
              ]}
            />
          )}

          {tab === 'document' && (
            <CodeForm
              apiCall={(body) => api.codeDocument({ language: body.language || 'Python', code: body.code, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Documentation Generator"
              resultTitle="Documented Code"
              buttonLabel="Generate Documentation"
              buttonIcon={FileText}
              isMarkdown={false}
              filename="documented-code.txt"
              fields={[
                { key: 'language', type: 'select-language', label: 'Programming Language' },
                { key: 'code', type: 'textarea', label: 'Paste your code', rows: 12 },
              ]}
            />
          )}

          {tab === 'commit' && (
            <CodeForm
              apiCall={(body) => api.codeCommit({ diff: body.diff, model: body.model, temperature: body.temperature, max_tokens: body.max_tokens })}
              title="Commit Generator"
              resultTitle="Commit & PR"
              buttonLabel="Generate Commit Message"
              buttonIcon={GitCommit}
              fields={[
                { key: 'diff', type: 'textarea', label: 'Paste your diff, or describe the change', rows: 14, placeholder: 'Paste `git diff` output, or just describe what changed…' },
              ]}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </PageWrapper>
  );
}
