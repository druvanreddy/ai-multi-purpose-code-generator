import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, Check } from 'lucide-react';
import { useState } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { copyToClipboard, downloadText } from '../../utils/helpers';

marked.setOptions({
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

export default function ResultCard({ title, result, raw, filename, isMarkdown = true, show }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(raw || result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.35 }}
          className="glass-card overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <div className="flex items-center gap-1">
              <button onClick={handleCopy} className="btn-ghost !p-2 !rounded-lg" title="Copy">
                {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
              </button>
              {filename && (
                <button
                  onClick={() => downloadText(filename, raw || result)}
                  className="btn-ghost !p-2 !rounded-lg"
                  title="Download"
                >
                  <Download size={15} />
                </button>
              )}
            </div>
          </div>
          <div className="p-5 overflow-x-auto">
            {isMarkdown ? (
              <div
                className="prose prose-invert prose-sm max-w-none
                  prose-pre:bg-surface-800/80 prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl
                  prose-code:text-primary-300 prose-code:bg-surface-800/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-xs
                  prose-headings:text-white prose-strong:text-white
                  prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline
                  prose-table:border-collapse
                  prose-th:bg-surface-800/60 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:border prose-th:border-white/[0.06]
                  prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:border prose-td:border-white/[0.06]"
                dangerouslySetInnerHTML={{ __html: marked.parse(result || '') }}
              />
            ) : (
              <pre className="text-sm text-surface-200 whitespace-pre-wrap font-mono">{result}</pre>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
