import { useState } from 'react';
import LoadingSpinner from '../ui/LoadingSpinner';
import ResultCard from '../ui/ResultCard';
import { LANGUAGES } from '../../utils/helpers';
import { useSettings } from '../../hooks/useSettings';
import toast from 'react-hot-toast';

export default function CodeForm({
  apiCall,
  title,
  resultTitle,
  fields = [],
  buttonLabel = 'Generate',
  buttonIcon: BtnIcon,
  isMarkdown = true,
  filename,
}) {
  const { settings } = useSettings();
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult('');
    try {
      const body = {
        ...values,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      };
      const res = await apiCall(body);
      setResult(res.result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="glass-card p-5 space-y-4">
        {fields.map((field) => {
          if (field.type === 'select-language') {
            return (
              <label key={field.key} className="block text-xs font-medium text-surface-400">
                {field.label}
                <select
                  className="select-field mt-1.5"
                  value={values[field.key] || LANGUAGES[0]}
                  onChange={(e) => set(field.key, e.target.value)}
                >
                  {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </select>
              </label>
            );
          }
          if (field.type === 'select') {
            return (
              <label key={field.key} className="block text-xs font-medium text-surface-400">
                {field.label}
                <select
                  className="select-field mt-1.5"
                  value={values[field.key] || field.options[0]}
                  onChange={(e) => set(field.key, e.target.value)}
                >
                  {field.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            );
          }
          if (field.type === 'textarea') {
            return (
              <label key={field.key} className="block text-xs font-medium text-surface-400">
                {field.label}
                <textarea
                  className="textarea-field mt-1.5"
                  rows={field.rows || 10}
                  placeholder={field.placeholder}
                  value={values[field.key] || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  required
                />
              </label>
            );
          }
          if (field.type === 'text') {
            return (
              <label key={field.key} className="block text-xs font-medium text-surface-400">
                {field.label}
                <input
                  type="text"
                  className="input-field mt-1.5"
                  placeholder={field.placeholder}
                  value={values[field.key] || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                />
              </label>
            );
          }
          if (field.type === 'chips') {
            const selected = values[field.key] || field.defaults || [];
            return (
              <div key={field.key}>
                <span className="block text-xs font-medium text-surface-400 mb-2">{field.label}</span>
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const s = selected.includes(opt)
                          ? selected.filter((x) => x !== opt)
                          : [...selected, opt];
                        set(field.key, s);
                      }}
                      className={`chip ${selected.includes(opt) ? 'chip-active' : ''}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            );
          }
          if (field.type === 'checkbox') {
            return (
              <label key={field.key} className="flex items-center gap-2 text-xs text-surface-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[field.key] || false}
                  onChange={(e) => set(field.key, e.target.checked)}
                  className="rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500/30"
                />
                {field.label}
              </label>
            );
          }
          return null;
        })}
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {BtnIcon && <BtnIcon size={16} />}
          {loading ? 'Generating…' : buttonLabel}
        </button>
      </form>

      {loading && <LoadingSpinner />}

      <ResultCard
        title={resultTitle}
        result={result}
        show={!!result && !loading}
        isMarkdown={isMarkdown}
        filename={filename}
      />
    </div>
  );
}
