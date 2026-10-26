import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings2, Cpu, Thermometer, Hash, Check, RotateCcw } from 'lucide-react';
import PageWrapper from '../components/layout/PageWrapper';
import Card from '../components/ui/Card';
import { useSettings } from '../hooks/useSettings';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

export default function Settings() {
  const { settings, update, reset } = useSettings();
  const [models, setModels] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getModels().then((d) => setModels(d.models || [])).catch(() => {});
  }, []);

  const handleSave = () => {
    setSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => {
    reset();
    toast.success('Reset to defaults');
  };

  return (
    <PageWrapper title="Settings" subtitle="Configure model and generation parameters">
      <Card>
        <div className="space-y-6">
          {/* Model */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-surface-400 mb-2">
              <Cpu size={14} className="text-primary-400" /> Model
            </label>
            <select
              className="select-field"
              value={settings.model}
              onChange={(e) => update('model', e.target.value)}
            >
              {models.length > 0
                ? models.map((m) => <option key={m} value={m}>{m}</option>)
                : <option value={settings.model}>{settings.model}</option>}
            </select>
            <p className="text-[10px] text-surface-600 mt-1">The LLM used for all AI features</p>
          </div>

          {/* Temperature */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-surface-400 mb-2">
              <Thermometer size={14} className="text-primary-400" /> Temperature — {settings.temperature}
            </label>
            <input
              type="range" min="0" max="2" step="0.1"
              value={settings.temperature}
              onChange={(e) => update('temperature', parseFloat(e.target.value))}
              className="w-full accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-surface-600 mt-1">
              <span>Precise (0)</span><span>Creative (2)</span>
            </div>
          </div>

          {/* Max tokens */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-surface-400 mb-2">
              <Hash size={14} className="text-primary-400" /> Max Tokens
            </label>
            <input
              type="number" min={256} max={32768} step={256}
              className="input-field"
              value={settings.maxTokens}
              onChange={(e) => update('maxTokens', parseInt(e.target.value, 10) || 8192)}
            />
            <p className="text-[10px] text-surface-600 mt-1">Maximum response length (256 – 32 768)</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              className="btn-primary"
            >
              {saved ? <Check size={16} /> : <Settings2 size={16} />}
              {saved ? 'Saved!' : 'Save Settings'}
            </motion.button>
            <button onClick={handleReset} className="btn-ghost">
              <RotateCcw size={15} /> Reset to Defaults
            </button>
          </div>
        </div>
      </Card>
    </PageWrapper>
  );
}
