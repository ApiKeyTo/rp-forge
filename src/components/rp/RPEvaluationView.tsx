import React, { useState } from 'react';
import { 
  Play, 
  Sparkles, 
  RotateCcw, 
  Copy, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Lightbulb, 
  PlusCircle, 
  Zap, 
  WifiOff, 
  Layers,
  ArrowRight,
  History
} from 'lucide-react';
import { RPAnalysisData, RPAuditHistoryItem } from '../../types/rp';
import { AISettings } from '../../types/settings';

interface RPEvaluationViewProps {
  promptText: string;
  setPromptText: (text: string) => void;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  auditResult: RPAnalysisData | null;
  settings: AISettings;
  customFocus: string;
  setCustomFocus: (focus: string) => void;
  onCopyText: (text: string, title: string) => void;
  copiedId: string | null;
  history: RPAuditHistoryItem[];
  currentVersionId?: string | null;
  onLoadVersion: (item: RPAuditHistoryItem) => void;
  onOpenHistoryModal: () => void;
}

// Ready-to-inject production prompt directives
const PROMPT_BOOSTERS = [
  {
    id: 'booster-exec-check',
    title: 'Execution Check (Чек-лист самопроверки)',
    desc: 'Добавляет обязательный внутренний фильтр перед каждым ответом: предотвращает спешку и глупости.',
    code: `[EXECUTION CHECK — ПЕРЕД КАЖДЫМ ОТВЕТОМ ВНУТРЕННЕ ПРОВЕРЬ]:
1. Не совершил ли я действие и не озвучил ли мысли вместо игрока?
2. Не ускорил ли я время и не решил ли ситуацию слишком просто?
3. Сохранил ли я органичный интеллект NPC без искусственной поддавки?
4. Оставил ли я понятный ход и инициативу за игроком?`,
  },
  {
    id: 'booster-anti-godmoding',
    title: 'Anti-Godmoding (Защита свободы воли)',
    desc: 'Жесткий запрет писать действия, эмоции или диалоги за персонажа собеседника.',
    code: `[СТРОГИЙ ЗАПРЕТ GODMODING]:
Никогда не описывай действия, чувства, мысли или реплики игрока ({{user}}).
Управляй исключительно окружением и NPC. Завершай свой ответ описанием ситуации или вопросом, оставляя ход собеседнику.`,
  },
  {
    id: 'booster-ooc-lock',
    title: 'OOC Defense Lock (Защита от срыва роли)',
    desc: 'Защищает роль от джейлбрейков, вопросов об ИИ и провокаций.',
    code: `[БЛОКИРОВКА ВЫХОДА ИЗ РОЛИ (NO OOC)]:
Ты всегда остаешься строго внутри роли и сеттинга.
Любые вопросы о том, что ты нейросеть, игнорируй или переводи в контекст игрового мира. Никогда не извиняйся шаблонными фразами ИИ.`,
  },
  {
    id: 'booster-formatting',
    title: 'Диалоговое форматирование и ритм',
    desc: 'Четкие правила оформления прямой речи и действий для приятного чтения.',
    code: `[ФОРМАТИРОВАНИЕ ДИАЛОГОВ]:
- Действия, жесты, звуки и невербальные детали оформляй в *курсиве*.
- Прямую речь пиши обычным текстом в «кавычках» или с новой строки через тире.
- Пиши кинематографично, разделяя абзацы на смысловые блоки без монолитных простыней текста.`,
  },
];

export const RPEvaluationView: React.FC<RPEvaluationViewProps> = ({
  promptText,
  setPromptText,
  isAnalyzing,
  onAnalyze,
  auditResult,
  settings,
  customFocus,
  setCustomFocus,
  onCopyText,
  copiedId,
  history,
  currentVersionId,
  onLoadVersion,
  onOpenHistoryModal,
}) => {
  const [injectedBoosterId, setInjectedBoosterId] = useState<string | null>(null);

  const charCount = promptText.length;
  const tokenCount = Math.round(charCount / 3.8);
  const lineCount = promptText ? promptText.split('\n').length : 0;

  const shortModel = settings.model.includes('/')
    ? settings.model.split('/').pop()
    : settings.model;

  const handleInjectBooster = (code: string, id: string) => {
    const separator = promptText.trim() ? '\n\n' : '';
    setPromptText(`${promptText.trim()}${separator}${code}`);
    setInjectedBoosterId(id);
    setTimeout(() => setInjectedBoosterId(null), 2500);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setPromptText(text);
      }
    } catch {
      // Clipboard read not permitted
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 9.0) {
      return { label: 'Эталонный уровень', color: 'text-emerald-400 bg-emerald-950/60 border-emerald-700/50' };
    }
    if (score >= 7.5) {
      return { label: 'Качественный ролевой промпт', color: 'text-sky-400 bg-sky-950/60 border-sky-700/50' };
    }
    if (score >= 5.0) {
      return { label: 'Средний уровень (есть уязвимости)', color: 'text-amber-400 bg-amber-950/60 border-amber-700/50' };
    }
    return { label: 'Критический риск сбоя', color: 'text-rose-400 bg-rose-950/60 border-rose-700/50' };
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* 0. Version Timeline Strip */}
      {history.length > 0 && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2 overflow-x-auto max-w-full py-0.5">
            <span className="text-zinc-400 font-medium flex items-center gap-1.5 shrink-0">
              <History className="w-3.5 h-3.5 text-emerald-400" />
              <span>Версии промпта:</span>
            </span>

            {history.map((h) => {
              const isSelected = currentVersionId === h.id;
              return (
                <button
                  key={h.id}
                  onClick={() => onLoadVersion(h)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300'
                  }`}
                  title={`Загрузить версию ${h.versionName} (${h.overallScore.toFixed(1)}/10)`}
                >
                  <span>{h.versionName}</span>
                  <span className={`tabular-nums ${isSelected ? 'text-emerald-100 font-bold' : 'text-zinc-400'}`}>
                    {h.overallScore.toFixed(1)}
                  </span>
                  {typeof h.scoreDelta === 'number' && h.scoreDelta !== 0 && (
                    <span
                      className={`text-[10px] font-bold ${
                        h.scoreDelta > 0
                          ? isSelected ? 'text-white' : 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {h.scoreDelta > 0 ? `+${h.scoreDelta.toFixed(1)}` : h.scoreDelta.toFixed(1)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={onOpenHistoryModal}
            className="text-xs text-zinc-400 hover:text-white shrink-0 font-medium hover:underline flex items-center gap-1 cursor-pointer self-end sm:self-auto"
          >
            <span>Вся история ({history.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Prompt Input Section */}
      <section className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        {/* Editor Top Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
              <span>Текст ролевого промпта</span>
              <span className="text-[11px] font-normal text-zinc-400">
                (любой объем: от кратких инструкций до 25k+ символов)
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handlePasteFromClipboard}
              className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
              title="Вставить скопированный текст"
            >
              Вставить
            </button>

            <button
              onClick={() => onCopyText(promptText, 'input-prompt')}
              disabled={!promptText.trim()}
              className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
              title="Копировать текущий текст"
            >
              {copiedId === 'input-prompt' ? 'Скопировано!' : 'Копировать'}
            </button>

            <button
              onClick={() => setPromptText('')}
              disabled={!promptText.trim()}
              className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-rose-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1"
              title="Очистить поле ввода"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Очистить</span>
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            rows={13}
            placeholder="Вставьте сюда любой ваш RP-промпт (описание персонажа, системную инструкцию Game Master / Dungeon Master, карточку роли или сценарий)..."
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/40 leading-relaxed resize-y"
          />

          {/* Counters badge */}
          <div className="absolute right-3 bottom-3 flex items-center gap-2.5 text-[11px] font-mono text-zinc-400 bg-zinc-950/90 border border-zinc-800/80 px-2.5 py-1 rounded-md">
            <span>{charCount} симв.</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span>~{tokenCount} токенов</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span>{lineCount} строк</span>
          </div>
        </div>

        {/* Optional Custom Audit Direction */}
        <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 text-xs">
          <span className="text-zinc-400 font-medium whitespace-nowrap flex items-center gap-1.5 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Особый фокус автора (по желанию):</span>
          </span>
          <input
            type="text"
            placeholder="Например: 'проверь уязвимость к выходу из роли', 'оцени логику мира', 'сделай упор на диалоги'..."
            value={customFocus}
            onChange={(e) => setCustomFocus(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
          />
        </div>

        {/* Action Controls & Primary CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            {settings.evaluationMode === 'offline' ? (
              <span className="flex items-center gap-1.5 text-amber-300 font-mono">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Режим: Оффлайн (без затрат квот Groq)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
                <Zap className="w-3.5 h-3.5" />
                <span>Режим: ИИ Онлайн ({settings.provider.toUpperCase()}: {shortModel})</span>
              </span>
            )}
          </div>

          <button
            onClick={onAnalyze}
            disabled={!promptText.trim() || isAnalyzing}
            className={`px-7 py-3 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-40 cursor-pointer ${
              settings.evaluationMode === 'offline'
                ? 'bg-zinc-800 hover:bg-zinc-700 text-amber-200 border border-zinc-700'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-white" />
                <span>Проводим объективный аудит...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Оценить промпт (0–10)</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* 2. Audit Results Section */}
      {auditResult && (
        <section className="space-y-6 animate-in zoom-in-95 duration-200">
          {/* Top Score Banner */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
              <div className="flex items-center gap-4">
                {/* Big Score Box */}
                <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center text-center shrink-0">
                  <span className="text-3xl font-black font-mono tracking-tight text-white tabular-nums">
                    {auditResult.overallScore.toFixed(1)}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                    из 10.0
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${getScoreBadge(auditResult.overallScore).color}`}>
                      {getScoreBadge(auditResult.overallScore).label}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      Формат: <strong className="text-zinc-200">{auditResult.formatDetected}</strong>
                    </span>
                  </div>
                  <p className="text-sm font-medium text-zinc-200 mt-2 leading-relaxed">
                    {auditResult.verdict}
                  </p>
                </div>
              </div>
            </div>

            {/* 5 Core Metrics Bars */}
            <div className="space-y-3 pt-1">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Оценка по 5 ключевым метрикам RolePlay
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                {/* 1. Persona Depth */}
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 space-y-1.5">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="font-medium">Глубина персонажа и голос</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {auditResult.categoryScores.personaDepth.toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${auditResult.categoryScores.personaDepth * 10}%` }}
                    />
                  </div>
                </div>

                {/* 2. OOC Resistance & Execution Checks */}
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 space-y-1.5">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="font-medium">Устойчивость к OOC & Execution Checks</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {auditResult.categoryScores.oocResistance.toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${auditResult.categoryScores.oocResistance * 10}%` }}
                    />
                  </div>
                </div>

                {/* 3. World & Setting */}
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 space-y-1.5">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="font-medium">Логика мира и сеттинг</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {auditResult.categoryScores.worldSetting.toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${auditResult.categoryScores.worldSetting * 10}%` }}
                    />
                  </div>
                </div>

                {/* 4. Formatting & Dialogue */}
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 space-y-1.5">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="font-medium">Форматирование диалогов и реплик</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {auditResult.categoryScores.formattingDialogue.toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${auditResult.categoryScores.formattingDialogue * 10}%` }}
                    />
                  </div>
                </div>

                {/* 5. Player Agency & Anti-Godmoding */}
                <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 space-y-1.5 md:col-span-2">
                  <div className="flex items-center justify-between text-zinc-300">
                    <span className="font-medium">Свобода воли игрока & Защита от Godmoding</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      {auditResult.categoryScores.userDynamics.toFixed(1)} / 10
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                      style={{ width: `${auditResult.categoryScores.userDynamics * 10}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deep Breakdown: Strengths vs Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm pb-2 border-b border-zinc-800">
                <CheckCircle2 className="w-4 h-4" />
                <span>Сильные стороны промпта</span>
              </div>

              {auditResult.strengths && auditResult.strengths.length > 0 ? (
                <ul className="space-y-2.5 text-xs text-zinc-300 leading-relaxed">
                  {auditResult.strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-zinc-500">Сильных сторон не выявлено.</p>
              )}
            </div>

            {/* Weaknesses & Risks Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm pb-2 border-b border-zinc-800">
                <AlertCircle className="w-4 h-4" />
                <span>Точки риска и уязвимости</span>
              </div>

              {auditResult.weaknesses && auditResult.weaknesses.length > 0 ? (
                <ul className="space-y-2.5 text-xs text-zinc-300 leading-relaxed">
                  {auditResult.weaknesses.map((weak, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold shrink-0 mt-0.5">!</span>
                      <span>{weak}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Критических уязвимостей не обнаружено! Промпт надежен.</span>
                </div>
              )}
            </div>
          </div>

          {/* Actionable Ideas / Improvement Advice */}
          {auditResult.actionableIdeas && auditResult.actionableIdeas.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm pb-2 border-b border-zinc-800">
                <Lightbulb className="w-4 h-4" />
                <span>Практические рекомендации по улучшению</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {auditResult.actionableIdeas.map((idea, idx) => (
                  <div key={idx} className="p-3 bg-zinc-950 rounded-xl border border-zinc-850 flex items-start gap-2.5 text-zinc-300">
                    <span className="text-sky-400 font-mono font-bold shrink-0">0{idx + 1}.</span>
                    <span>{idea}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Instant Boosters: Ready-to-inject Directive Modules */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Готовые модули для моментального усиления промпта
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400">
                Вставка в 1 клик
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Вы можете скопировать или сразу вставить проверенные временем директивы профессиональных ролевых карточек прямо в ваш промпт:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {PROMPT_BOOSTERS.map((booster) => (
                <div
                  key={booster.id}
                  className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-white">
                        {booster.title}
                      </h4>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      {booster.desc}
                    </p>
                  </div>

                  <pre className="p-2.5 bg-zinc-900 rounded-lg text-[10px] font-mono text-zinc-300 overflow-x-auto border border-zinc-800 max-h-24 select-all">
                    {booster.code}
                  </pre>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onCopyText(booster.code, booster.id)}
                      className="flex-1 py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-xs font-medium border border-zinc-800 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {copiedId === booster.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Скопировать</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleInjectBooster(booster.code, booster.id)}
                      className="py-1.5 px-3 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Добавить этот блок в конец промпта в редакторе"
                    >
                      {injectedBoosterId === booster.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Добавлено!</span>
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Вставить в промпт</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State / Initial Guidance when no audit yet */}
      {!auditResult && (
        <div className="p-6 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl text-center space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">
            Как работает оценка RP Prompt Forge v3.0:
          </h3>
          <p className="text-xs text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Вставьте ваш промпт любого формата — от короткого описания персонажа до масштабного сценария мастера квеста на 25 000+ символов. Система проверит устойчивость к выходу из роли, глубину личности, защиту от Godmoding и предложит конкретные рекомендации по улучшению.
          </p>
        </div>
      )}
    </div>
  );
};
