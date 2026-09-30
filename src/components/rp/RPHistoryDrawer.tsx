import React from 'react';
import { 
  X, 
  History, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownRight, 
  Minus, 
  Clock, 
  Check, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { RPAuditHistoryItem } from '../../types/rp';

interface RPHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: RPAuditHistoryItem[];
  onSelectVersion: (item: RPAuditHistoryItem) => void;
  onDeleteVersion: (id: string) => void;
  onClearHistory: () => void;
  currentLoadedId?: string | null;
}

export const RPHistoryDrawer: React.FC<RPHistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectVersion,
  onDeleteVersion,
  onClearHistory,
  currentLoadedId,
}) => {
  if (!isOpen) return null;

  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 9.0) return 'text-emerald-400 bg-emerald-950/60 border-emerald-700/50';
    if (score >= 7.5) return 'text-sky-400 bg-sky-950/60 border-sky-700/50';
    if (score >= 5.0) return 'text-amber-400 bg-amber-950/60 border-amber-700/50';
    return 'text-rose-400 bg-rose-950/60 border-rose-700/50';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-150">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <History className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>История прогонов</span>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    {history.length}
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Сохранено в localStorage для сравнения версий
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <button
                  onClick={onClearHistory}
                  className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-900 transition-colors"
                  title="Очистить всю историю"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List of Versions */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                  <Clock className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-zinc-300">
                    История пока пуста
                  </h4>
                  <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                    Запустите аудит любого промпта, и каждая проверенная версия (v1, v2, v3) автоматически сохранится здесь со всеми баллами.
                  </p>
                </div>
              </div>
            ) : (
              history.map((item, index) => {
                const isCurrent = currentLoadedId === item.id;
                const hasDelta = typeof item.scoreDelta === 'number' && item.scoreDelta !== 0;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-2.5 relative group ${
                      isCurrent
                        ? 'bg-zinc-900 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/20'
                        : 'bg-zinc-900/60 hover:bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {/* Top Row: Version Name, Score, Delta & Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                          {item.versionName}
                        </span>

                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold border ${getScoreBadgeColor(item.overallScore)}`}>
                          <span>{item.overallScore.toFixed(1)}</span>
                          <span className="text-[10px] opacity-70">/10</span>
                        </div>

                        {/* Delta indicator vs previous iteration */}
                        {hasDelta && item.scoreDelta! > 0 && (
                          <span className="flex items-center text-[11px] font-mono font-semibold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>+{item.scoreDelta!.toFixed(1)}</span>
                          </span>
                        )}
                        {hasDelta && item.scoreDelta! < 0 && (
                          <span className="flex items-center text-[11px] font-mono font-semibold text-rose-400 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-800/40">
                            <ArrowDownRight className="w-3 h-3" />
                            <span>{item.scoreDelta!.toFixed(1)}</span>
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-zinc-500 font-mono">
                        {formatTimestamp(item.timestamp)}
                      </span>
                    </div>

                    {/* Verdict / Snippet */}
                    <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed font-sans">
                      {item.auditResult.verdict}
                    </p>

                    <div className="p-2 bg-zinc-950/80 rounded-lg text-[11px] font-mono text-zinc-400 line-clamp-2 border border-zinc-850">
                      {item.promptSnippet}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {item.provider.toUpperCase()} ({item.model.split('/').pop()})
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onDeleteVersion(item.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
                          title="Удалить эту запись"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onSelectVersion(item)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-all ${
                            isCurrent
                              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white'
                          }`}
                        >
                          {isCurrent ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Выбрано</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              <span>Загрузить</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
