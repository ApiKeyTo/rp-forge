import React, { useState } from 'react';
import { X, Key, Cpu, ExternalLink, Check, AlertCircle, RefreshCw, Zap, ShieldCheck } from 'lucide-react';
import { AISettings } from '../../types/settings';

interface AISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSaveSettings: (settings: AISettings) => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  const [current, setCurrent] = useState<AISettings>(settings);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isCustomGroqModel, setIsCustomGroqModel] = useState(false);

  React.useEffect(() => {
    setCurrent(settings);
    setTestResult(null);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleTestKey = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: current.provider,
          apiKey: current.apiKey,
          model: current.model,
          customEndpoint: current.customEndpoint,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResult({ ok: true, message: data.message || `Ключ и модель "${current.model}" успешно проверены!` });
      } else {
        setTestResult({ ok: false, message: data.error || 'Ошибка проверки ключа' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Сбой сети при проверке' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(current);
    onClose();
  };

  const groqFreeModels = [
    {
      id: 'openai/gpt-oss-120b',
      title: 'openai/gpt-oss-120b',
      desc: '🔥 Рекомендуется: Мощнейшая 120B модель, глубокий анализ RP',
    },
    {
      id: 'qwen/qwen3.8-27b',
      title: 'qwen/qwen3.8-27b',
      desc: '✨ Qwen 27B: Великолепный художественный русский слог',
    },
    {
      id: 'openai/gpt-oss-20b',
      title: 'openai/gpt-oss-20b',
      desc: '⚡ 20B: Быстрая и легкая модель',
    },
    {
      id: 'canopylabs/orpheus-v1-english',
      title: 'canopylabs/orpheus-v1-english',
      desc: 'Canopy Labs Orpheus v1',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Настройки ИИ и API ключа
              </h3>
              <p className="text-[11px] text-slate-400">
                Подключи бесплатные модели Groq или Gemini для точной оценки
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          {/* Provider Selection Tabs */}
          <div>
            <label className="block text-slate-300 font-semibold mb-2">
              Провайдер нейросети
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  setCurrent({
                    ...current,
                    provider: 'groq',
                    model: 'openai/gpt-oss-120b',
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-colors ${
                  current.provider === 'groq'
                    ? 'bg-slate-800 border-emerald-500 text-white shadow-xs'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-white">⚡ Groq (Бесплатно)</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">gpt-oss-120b / qwen</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCurrent({
                    ...current,
                    provider: 'gemini',
                    model: 'gemini-3.8-flash',
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-colors ${
                  current.provider === 'gemini'
                    ? 'bg-slate-800 border-sky-500 text-white shadow-xs'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-white">🤖 Google Gemini</div>
                <div className="text-[10px] text-sky-400 mt-0.5">Gemini 3.8 Flash</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setCurrent({
                    ...current,
                    provider: 'custom',
                    model: 'openai/gpt-oss-120b',
                  })
                }
                className={`p-2.5 rounded-xl border text-left transition-colors ${
                  current.provider === 'custom'
                    ? 'bg-slate-800 border-purple-500 text-white shadow-xs'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="font-bold text-xs text-white">🌐 OpenRouter / Свой</div>
                <div className="text-[10px] text-purple-400 mt-0.5">OpenAI совместимый</div>
              </button>
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {current.provider === 'groq'
                    ? 'API Ключ Groq (gsk_...)'
                    : current.provider === 'gemini'
                    ? 'API Ключ Gemini (AIza...)'
                    : 'API Ключ провайдера'}
                </span>
              </label>

              {current.provider === 'groq' && (
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>Получить ключ бесплатно</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <input
              type="password"
              placeholder={
                current.provider === 'groq'
                  ? 'Вставьте ключ gsk_... (сохраняется только в вашем браузере)'
                  : 'Вставьте ваш API ключ...'
              }
              value={current.apiKey}
              onChange={(e) => setCurrent({ ...current, apiKey: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Model Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                <span>Модель в Groq</span>
              </label>

              {current.provider === 'groq' && (
                <button
                  type="button"
                  onClick={() => setIsCustomGroqModel(!isCustomGroqModel)}
                  className="text-[11px] text-sky-400 hover:underline"
                >
                  {isCustomGroqModel ? 'Выбрать из списка' : 'Ввести свой ID модели'}
                </button>
              )}
            </div>

            {current.provider === 'groq' ? (
              isCustomGroqModel ? (
                <input
                  type="text"
                  placeholder="Например: openai/gpt-oss-120b или qwen/qwen3.8-27b"
                  value={current.model}
                  onChange={(e) => setCurrent({ ...current, model: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              ) : (
                <select
                  value={current.model}
                  onChange={(e) => setCurrent({ ...current, model: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {groqFreeModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} — {m.desc}
                    </option>
                  ))}
                </select>
              )
            ) : current.provider === 'gemini' ? (
              <select
                value={current.model}
                onChange={(e) => setCurrent({ ...current, model: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="gemini-3.8-flash">gemini-3.8-flash (Быстрый анализ и генерация)</option>
              </select>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="ID модели, например openai/gpt-oss-120b или deepseek/deepseek-r1"
                  value={current.model}
                  onChange={(e) => setCurrent({ ...current, model: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  placeholder="URL эндпоинта (например https://openrouter.ai/api/v1/chat/completions)"
                  value={current.customEndpoint || ''}
                  onChange={(e) => setCurrent({ ...current, customEndpoint: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            )}
          </div>

          {/* Privacy Note */}
          <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start gap-2.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              Ключ хранится локально в вашем браузере (LocalStorage) и отправляется на безопасный прокси-маршрут только при выполнении ваших запросов.
            </span>
          </div>

          {/* Test connection feedback */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                testResult.ok
                  ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-800 text-rose-300'
              }`}
            >
              {testResult.ok ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="leading-snug">{testResult.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTestKey}
              disabled={!current.apiKey.trim() || isTesting}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {isTesting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>Проверить ключ</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors shadow-xs"
              >
                Сохранить настройки
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
