import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

const DEFAULTS = {
  model: 'openai/gpt-oss-120b',
  temperature: 0.2,
  maxTokens: 8192,
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('dmixerai-settings');
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  const [models, setModels] = useState([]);

  useEffect(() => {
    localStorage.setItem('dmixerai-settings', JSON.stringify(settings));
  }, [settings]);

  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  return (
    <SettingsContext.Provider value={{ settings, update, models, setModels }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
