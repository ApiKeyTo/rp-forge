import React, { useState, useEffect } from 'react';
import { RPNavbar } from './components/rp/RPNavbar';
import { RPEvaluationView } from './components/rp/RPEvaluationView';
import { AISettingsModal } from './components/rp/AISettingsModal';
import { RPHistoryDrawer } from './components/rp/RPHistoryDrawer';
import { Toast, ToastMessage } from './components/Toast';
import { RPAnalysisData, RPAuditHistoryItem } from './types/rp';
import { AISettings, DEFAULT_AI_SETTINGS } from './types/settings';

const STORAGE_KEY_SETTINGS = 'rp_forge_ai_settings_v3';
const STORAGE_KEY_HISTORY = 'rp_forge_audit_history_v3';

export default function App() {
  const [promptText, setPromptText] = useState<string>(() => {
    return `Ты — беспристрастный ведущий и мастер ролевой игры (Game Master) в сеттинге мрачной аномальной Зоны отчуждения.

ТВОЯ ЗАДАЧА:
- Описывай окружение кинематографично, с упором на звуки, запахи, скрип дозиметра и ощущение постоянной угрозы.
- Управляй всеми второстепенными персонажами (мутанты, сталкеры у костра, бандиты, военные патрули).
- Не решай за игрока! После каждого описания ситуации или действия NPC ставь паузу и спрашивай: «Что предпринимаешь?» или давай 2-3 возможных пути.
- Если игрок совершает рискованное действие (прыжок в аномалию, выстрел наугад в тумане) — описывай правдоподобные последствия в зависимости от его осторожности.

АТМОСФЕРА:
Поздняя осень, вечный сырой туман, ржавые советские вышки, скрип металла и радиопомехи. Никакого дешевого пафоса — Зона опасна, и каждая ошибка стоит дорого.

[ФИНАЛЬНЫЙ EXECUTION CHECK]:
Перед каждым ответом GM внутренне проверь:
1. Не написал ли я действие или мысль за игрока?
2. Не принял ли я решение вместо игрока?
3. Не ускорил ли я время?
4. Не сделал ли NPC глупее ради подыгрывания?
5. Помнят ли персонажи предыдущие события?
6. Есть ли последствия прошлых сцен?`;
  });

  const [auditResult, setAuditResult] = useState<RPAnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [currentLoadedHistoryId, setCurrentLoadedHistoryId] = useState<string | null>(null);
  const [customFocus, setCustomFocus] = useState('');

  // Settings state
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = 
        localStorage.getItem('rp_forge_ai_settings_v3') ||
        localStorage.getItem('rp_forge_ai_settings_v2') ||
        localStorage.getItem('rp_forge_ai_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...DEFAULT_AI_SETTINGS, ...parsed };
      }
    } catch {
      // ignore
    }
    return DEFAULT_AI_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  // History state
  const [history, setHistory] = useState<RPAuditHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch {
      // ignore
    }
  }, [history]);

  const addToast = (text: string, type: 'success' | 'info' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(id);
      addToast('Текст скопирован в буфер обмена!');
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      addToast('Не удалось скопировать текст', 'info');
    }
  };

  const handleAnalyzePrompt = async () => {
    if (!promptText.trim()) {
      addToast('Введите текст промпта перед аудитом!', 'info');
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-rp-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          style: settings.rpStyle,
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          customEndpoint: settings.customEndpoint,
          customFocus: customFocus.trim(),
          evaluationMode: settings.evaluationMode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Ошибка сервера при анализе');
      }

      const data: RPAnalysisData = await res.json();
      setAuditResult(data);

      // Auto-save to local version history
      const latestItem = history[0];
      const scoreDelta = latestItem 
        ? Math.round((data.overallScore - latestItem.overallScore) * 10) / 10 
        : undefined;

      const historyNumber = history.length + 1;
      const newHistoryItem: RPAuditHistoryItem = {
        id: `audit-${Date.now()}`,
        versionNumber: historyNumber,
        versionName: `v${historyNumber}`,
        timestamp: Date.now(),
        promptText,
        promptSnippet: promptText.slice(0, 110).replace(/\n/g, ' ') + (promptText.length > 110 ? '...' : ''),
        overallScore: data.overallScore,
        scoreDelta,
        auditResult: data,
        provider: settings.provider,
        model: settings.model,
      };

      setHistory((prev) => [newHistoryItem, ...prev]);
      setCurrentLoadedHistoryId(newHistoryItem.id);

      addToast(
        settings.evaluationMode === 'offline'
          ? `Оффлайн-аудит завершен! Оценка: ${data.overallScore.toFixed(1)} / 10 (сохранено как v${historyNumber})`
          : `ИИ-аудит (${settings.model.split('/').pop()}) завершен! Оценка: ${data.overallScore.toFixed(1)} / 10 (сохранено как v${historyNumber})`
      );
    } catch (err: any) {
      console.error(err);
      addToast(err.message || 'Ошибка проведения аудита. Проверьте соединение или API ключ.', 'info');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSelectHistoryVersion = (item: RPAuditHistoryItem) => {
    setPromptText(item.promptText);
    setAuditResult(item.auditResult);
    setCurrentLoadedHistoryId(item.id);
    setIsHistoryDrawerOpen(false);
    addToast(`Загружена версия ${item.versionName} (Балл: ${item.overallScore.toFixed(1)}/10)`);
  };

  const handleDeleteHistoryVersion = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (currentLoadedHistoryId === id) {
      setCurrentLoadedHistoryId(null);
    }
    addToast('Версия удалена из истории', 'info');
  };

  const handleClearHistory = () => {
    setHistory([]);
    setCurrentLoadedHistoryId(null);
    addToast('История проверок очищена', 'info');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Navbar v3.0 */}
      <RPNavbar
        score={auditResult ? auditResult.overallScore : null}
        settings={settings}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onUpdateSettings={setSettings}
        historyCount={history.length}
        onOpenHistory={() => setIsHistoryDrawerOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RPEvaluationView
          promptText={promptText}
          setPromptText={setPromptText}
          isAnalyzing={isAnalyzing}
          onAnalyze={handleAnalyzePrompt}
          auditResult={auditResult}
          settings={settings}
          customFocus={customFocus}
          setCustomFocus={setCustomFocus}
          onCopyText={handleCopyText}
          copiedId={copiedId}
          history={history}
          currentVersionId={currentLoadedHistoryId}
          onLoadVersion={handleSelectHistoryVersion}
          onOpenHistoryModal={() => setIsHistoryDrawerOpen(true)}
        />
      </main>

      {/* Modern Minimal Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/80 py-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>RP Forge v3.0 — Объективная оценка и усиление ролевых промптов для нейросетей</span>
          <span className="font-mono text-zinc-400">
            Движок: {settings.evaluationMode === 'offline' ? 'Оффлайн' : `${settings.provider.toUpperCase()} (${settings.model.split('/').pop()})`}
          </span>
        </div>
      </footer>

      {/* Settings Modal */}
      <AISettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => {
          setSettings(newSettings);
          addToast(`Настройки сохранены: ${newSettings.provider.toUpperCase()} (${newSettings.model.split('/').pop()})`);
        }}
      />

      {/* History Drawer */}
      <RPHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        history={history}
        onSelectVersion={handleSelectHistoryVersion}
        onDeleteVersion={handleDeleteHistoryVersion}
        onClearHistory={handleClearHistory}
        currentLoadedId={currentLoadedHistoryId}
      />

      {/* Notification Toast */}
      <Toast toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
