import React from 'react';
import { Skull, Settings, Zap, Wifi, WifiOff, History } from 'lucide-react';
import { AISettings } from '../../types/settings';

interface RPNavbarProps {
  score: number | null;
  settings: AISettings;
  historyCount: number;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onUpdateSettings: (settings: AISettings) => void;
}

export const RPNavbar: React.FC<RPNavbarProps> = ({
  score,
  settings,
  historyCount,
  onOpenSettings,
  onOpenHistory,
  onUpdateSettings,
}) => {
  const isKeyConfigured = !!settings.apiKey.trim();
  const shortModel = settings.model.includes('/')
    ? settings.model.split('/').pop()
    : settings.model;

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Zone */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Skull className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-white leading-none">
                  RP Forge
                </span>
                <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                  v3.0
                </span>
              </div>
              <span className="text-[11px] text-zinc-400 tracking-normal mt-0.5">
                Аудит & Улучшение ролевых промптов
              </span>
            </div>
          </div>

          {/* Center Zone: Mode Switcher (AI Online vs Offline) */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, evaluationMode: 'ai' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                settings.evaluationMode === 'ai'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Онлайн-оценка через нейросеть Groq / Gemini"
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>ИИ Онлайн</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ ...settings, evaluationMode: 'offline' })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                settings.evaluationMode === 'offline'
                  ? 'bg-zinc-800 text-amber-300 shadow-sm font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Мгновенный локальный аудит без расхода токенов и интернета"
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Оффлайн</span>
            </button>
          </div>

          {/* Right Action Zone: History + Settings Button */}
          <div className="flex items-center gap-2">
            {score !== null && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-mono">
                <span className="text-zinc-500">Балл:</span>
                <span className="font-bold text-emerald-400 tabular-nums">
                  {score.toFixed(1)}/10
                </span>
              </div>
            )}

            {/* History Versions Button */}
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="История прогонов и версий (v1, v2, v3...)"
            >
              <History className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden md:inline">История</span>
              {historyCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold">
                  {historyCount}
                </span>
              )}
            </button>

            {/* Settings button */}
            <button
              onClick={onOpenSettings}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                isKeyConfigured
                  ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
              title="Настройки API ключа и выбор модели"
            >
              <Zap className={`w-3.5 h-3.5 ${isKeyConfigured ? 'text-emerald-400' : 'text-amber-400'}`} />
              <span className="font-mono text-[11px] hidden sm:inline">
                {settings.evaluationMode === 'offline'
                  ? 'Оффлайн'
                  : `${settings.provider.toUpperCase()}: ${shortModel}`}
              </span>
              <Settings className="w-3.5 h-3.5 text-zinc-400 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
