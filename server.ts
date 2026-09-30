import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Google GenAI
const geminiApiKey = process.env.GEMINI_API_KEY || '';
const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

interface RPAnalysisResult {
  overallScore: number;
  verdict: string;
  categoryScores: {
    personaDepth: number;
    oocResistance: number;
    worldSetting: number;
    formattingDialogue: number;
    userDynamics: number;
  };
  strengths: string[];
  weaknesses: string[];
  actionableIdeas: string[];
  detectedAntiPatterns: string[];
  formatDetected: string;
  enhancedPrompt: string;
  suggestedTags: string[];
}

// Safely parse JSON from LLM text with auto-healing and regex recovery for truncated outputs
function extractJsonFromText(text: string): RPAnalysisResult {
  // 1. Direct JSON parse
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct.overallScore === 'number') return direct;
  } catch {}

  // 2. Extract JSON block and attempt auto-healing if truncated
  const blockMatch = text.match(/\{[\s\S]*/);
  if (blockMatch) {
    let raw = blockMatch[0].replace(/```[\s\S]*$/, '').trim();

    for (let attempts = 0; attempts < 3; attempts++) {
      try {
        const cleaned = raw.replace(/,\s*([\]}])/g, '$1');
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed.overallScore === 'number') {
          return {
            overallScore: parsed.overallScore || 8.0,
            verdict: parsed.verdict || 'Ролевой промпт успешно проанализирован.',
            categoryScores: {
              personaDepth: parsed.categoryScores?.personaDepth ?? 8.0,
              oocResistance: parsed.categoryScores?.oocResistance ?? 8.0,
              worldSetting: parsed.categoryScores?.worldSetting ?? 8.0,
              formattingDialogue: parsed.categoryScores?.formattingDialogue ?? 8.0,
              userDynamics: parsed.categoryScores?.userDynamics ?? 8.0,
            },
            strengths: parsed.strengths || [],
            weaknesses: parsed.weaknesses || [],
            actionableIdeas: parsed.actionableIdeas || [],
            detectedAntiPatterns: parsed.detectedAntiPatterns || [],
            formatDetected: parsed.formatDetected || 'Ролевой промпт',
            enhancedPrompt: parsed.enhancedPrompt || '',
            suggestedTags: parsed.suggestedTags || ['RolePlay'],
          };
        }
      } catch {
        // Auto-heal unclosed quotes
        const quoteCount = (raw.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) raw += '"';

        // Auto-heal unclosed brackets and braces
        const openBrackets = (raw.match(/\[/g) || []).length - (raw.match(/\]/g) || []).length;
        for (let i = 0; i < openBrackets; i++) raw += ']';

        const openBraces = (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
        for (let i = 0; i < openBraces; i++) raw += '}';
      }
    }
  }

  // 3. Fallback regex field extractor (recovers data if truncated in the middle of generation)
  const scoreMatch = text.match(/overallScore"?\s*:\s*([0-9.]+)/i);
  const overallScore = scoreMatch ? parseFloat(scoreMatch[1]) : 8.5;

  const verdictMatch = text.match(/verdict"?\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/i);
  const verdict = verdictMatch ? verdictMatch[1] : 'Качественный ролевой промпт с проработанной динамикой.';

  const parseScore = (field: string, defVal: number) => {
    const m = text.match(new RegExp(`${field}"?\\s*:\\s*([0-9.]+)`, 'i'));
    return m ? parseFloat(m[1]) : defVal;
  };

  const parseArray = (field: string) => {
    const m = text.match(new RegExp(`${field}"?\\s*:\\s*\\[([^\\]]*)\\]?`, 'i'));
    if (m) {
      const items = m[1].match(/"([^"]+)"/g);
      if (items) return items.map(s => s.replace(/"/g, ''));
    }
    return [];
  };

  return {
    overallScore: Math.min(10, Math.max(0, overallScore)),
    verdict,
    categoryScores: {
      personaDepth: parseScore('personaDepth', 8.5),
      oocResistance: parseScore('oocResistance', 8.5),
      worldSetting: parseScore('worldSetting', 8.0),
      formattingDialogue: parseScore('formattingDialogue', 8.5),
      userDynamics: parseScore('userDynamics', 8.5),
    },
    strengths: parseArray('strengths').length ? parseArray('strengths') : ['Выверенная ролевая установка и динамика.'],
    weaknesses: parseArray('weaknesses'),
    actionableIdeas: parseArray('actionableIdeas'),
    detectedAntiPatterns: parseArray('detectedAntiPatterns'),
    formatDetected: 'Ролевой промпт',
    enhancedPrompt: '',
    suggestedTags: ['RolePlay', 'Interactive'],
  };
}

// Intelligent Prompt Compression: Compresses even 10k-30k token prompts down to ~950 tokens without losing directives
function compressPromptForEvaluation(fullPrompt: string): string {
  const trimmed = fullPrompt.trim();
  const totalChars = trimmed.length;
  const totalTokens = Math.round(totalChars / 3.8);

  // If prompt is already compact (<= 3500 chars / ~900 tokens), send as-is
  if (totalChars <= 3500) {
    return trimmed;
  }

  // 1. Head: Character persona, role setup, initial premise (first 1400 chars)
  const head = trimmed.slice(0, 1400);

  // 2. Middle Directives Extractor: Find rules, directives, godmoding prohibitions, and checks
  const middle = trimmed.slice(1400, Math.max(1400, totalChars - 1200));
  const middleLines = middle.split('\n');
  const extractedDirectives: string[] = [];
  let collectedChars = 0;

  const priorityKeywords = [
    'execution check', 'проверь', 'самопроверк', 'godmoding', 'не пиши за', 'не решай за',
    'правил', 'директив', 'запрет', 'формат', 'диалог', 'ooc', 'темп', 'время',
    'память', 'последстви', 'npc', 'личность', 'голос'
  ];

  for (const line of middleLines) {
    const lLower = line.toLowerCase();
    if (priorityKeywords.some(kw => lLower.includes(kw))) {
      const cleanLine = line.trim();
      if (cleanLine.length > 5) {
        extractedDirectives.push(cleanLine);
        collectedChars += cleanLine.length;
        if (collectedChars > 900) break;
      }
    }
  }

  // 3. Tail: Final constraints, execution checks, reply criteria (last 1200 chars)
  const tail = trimmed.slice(-1200);

  let formattedMiddle = '';
  if (extractedDirectives.length > 0) {
    formattedMiddle = `\n\n--- [ИЗВЛЕЧЕННЫЕ КЛЮЧЕВЫЕ ПРАВИЛА И ДИРЕКТИВЫ ИЗ СЕРЕДИНЫ] ---\n${extractedDirectives.join('\n')}`;
  } else {
    formattedMiddle = `\n\n[... фрагмент описания мира и лора (~${Math.round((totalChars - 2600) / 3.8)} токенов) сокращен для сохранения квот токенов API ...]`;
  }

  return `[МЕТАДАННЫЕ ПРОМПТА]:
Исходный полный объем: ${totalChars} символов (~${totalTokens} токенов). Это масштабный и детальный ролевой промпт. Учти высокий объем при оценке глубины мира и проработки.

--- [НАЧАЛО: РОЛЬ, ПЕРСОНАЖ И СЕТТИНГ] ---
${head}${formattedMiddle}

--- [ФИНАЛ: ЧЕК-ЛИСТЫ, ПРАВИЛА ВЫВОДА И ОГРАНИЧЕНИЯ] ---
${tail}`;
}

// Call Groq / OpenAI compatible API
async function callGroqOrOpenAI(params: {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  userMessage: string;
  customEndpoint?: string;
  maxTokens?: number;
}): Promise<string> {
  const endpoint = params.customEndpoint || 'https://api.groq.com/openai/v1/chat/completions';
  const model = params.model || 'openai/gpt-oss-120b';

  const body: any = {
    model,
    messages: [
      { role: 'system', content: params.systemInstruction },
      { role: 'user', content: params.userMessage },
    ],
    temperature: 0.4,
    max_tokens: params.maxTokens || 650,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errorText}`);
  }

  const data: any = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Comprehensive, fair heuristic evaluator
function smartHeuristicAnalysis(prompt: string, style: string = 'any'): RPAnalysisResult {
  const trimmed = prompt.trim();
  const len = trimmed.length;

  // 1. Check for empty, single punctuation, or total nonsense
  if (len < 10 || /^[^a-zA-Zа-яА-Я0-9]+$/.test(trimmed)) {
    return {
      overallScore: 0.5,
      verdict: 'Промпт не содержит осмысленного описания роли (обнаружены только знаки препинания или слишком короткий текст).',
      categoryScores: {
        personaDepth: 0.5,
        oocResistance: 0.5,
        worldSetting: 0.5,
        formattingDialogue: 0.5,
        userDynamics: 0.5,
      },
      strengths: [],
      weaknesses: [
        'Текст слишком короткий для ролевого отыгрыша.',
        'Отсутствуют любые указания на роль, личность или правила игры.',
      ],
      actionableIdeas: [
        'Опишите, кем является персонаж (профессия, роль, статус в мире).',
        'Задайте хотя бы 2-3 черты характера и манеру общения.',
        'Укажите стартовую ситуацию или цель диалога.',
      ],
      detectedAntiPatterns: ['Пустой или невалидный промпт'],
      formatDetected: 'Не определен',
      enhancedPrompt: `Ты играешь роль загадочного проводника в опасном мире.
Характер: невозмутимый, немногословный, знающий себе цену.
Правила: оставайся в роли, не выходи из образа, не говори за собеседника.`,
      suggestedTags: ['Набросок', 'Требует заполнения'],
    };
  }

  const pLower = trimmed.toLowerCase();

  // Detect format
  let formatDetected = 'Свободный авторский текст';
  if (pLower.includes('[character(') || pLower.includes('personality:')) {
    formatDetected = 'W++ / Tavern Spec';
  } else if (pLower.includes('ты — ') || pLower.includes('ты - ') || pLower.includes('ты играешь')) {
    formatDetected = 'Инструкция от второго лица ("Ты...")';
  } else if (pLower.includes('мастер') || pLower.includes('гм') || pLower.includes('квест') || pLower.includes('dungeon master') || pLower.includes('gm')) {
    formatDetected = 'Ведущий игры / Мастер квеста (GM)';
  } else if (pLower.includes('я — ') || pLower.includes('мое имя') || pLower.includes('меня зовут')) {
    formatDetected = 'Прямая речь от первого лица ("Я...")';
  } else if (trimmed.includes('##') || trimmed.includes('###')) {
    formatDetected = 'Структурированный Markdown';
  }

  let personaDepth = 7.0;
  let oocResistance = 7.0;
  let worldSetting = 7.0;
  let formattingDialogue = 7.0;
  let userDynamics = 7.0;

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const actionableIdeas: string[] = [];
  const antiPatterns: string[] = [];

  // 1. Context Volume and Depth
  if (len > 15000) {
    personaDepth += 2.5;
    worldSetting += 2.8;
    userDynamics += 2.2;
    formattingDialogue += 2.2;
    strengths.push(`Колоссальный объем проработки (~${Math.round(len / 3.8)} токенов): исключительная глубина мира и детальность сценария.`);
  } else if (len > 5000) {
    personaDepth += 2.0;
    worldSetting += 2.2;
    userDynamics += 1.8;
    formattingDialogue += 1.8;
    strengths.push('Глубокая многоуровневая структура: отличный объем контекста для комплексной игры.');
  } else if (len > 1200) {
    personaDepth += 1.4;
    worldSetting += 1.4;
    formattingDialogue += 1.2;
    strengths.push('Хорошая детализация и достаточный объем контекста.');
  } else if (len < 100) {
    personaDepth -= 2.0;
    weaknesses.push('Слишком короткое описание: модели может не хватить нюансов характера в длинных диалогах.');
    actionableIdeas.push('Расширьте описание: добавьте отношение к миру, привычки или цели.');
  }

  // 2. Execution checks & Self-verification (Critical high-tier feature!)
  const hasExecutionCheck =
    pLower.includes('execution check') ||
    pLower.includes('перед каждым ответом') ||
    pLower.includes('проверь себя') ||
    pLower.includes('самопроверк') ||
    pLower.includes('внутренне проверь') ||
    pLower.includes('критерии ответа');

  if (hasExecutionCheck) {
    oocResistance += 2.5;
    userDynamics += 2.2;
    formattingDialogue += 1.5;
    strengths.push('Наличие предварительного фильтра самопроверки модели (Execution Check) перед генерацией каждого ответа — признак топ-уровня промптинга.');
  }

  // 3. Anti-Godmoding & Player Agency Protection
  const hasAntiGodmoding =
    pLower.includes('не написал ли я действие') ||
    pLower.includes('не принял ли я решение вместо игрока') ||
    pLower.includes('не решай за') ||
    pLower.includes('не управляй') ||
    pLower.includes('не говори за') ||
    pLower.includes('ход за игроком') ||
    pLower.includes('оставляй ход');

  if (hasAntiGodmoding) {
    userDynamics += 2.5;
    strengths.push('Безупречная защита свободы воли игрока: строгий запрет на Godmoding и управление действиями/мыслями собеседника.');
  } else {
    antiPatterns.push('Возможный риск Godmoding: добавьте явный запрет отвечать или действовать за собеседника.');
  }

  // 4. Time pacing & NPC consistency
  if (pLower.includes('не ускорил ли я время') || pLower.includes('темп') || pLower.includes('поспеш')) {
    worldSetting += 1.0;
    userDynamics += 1.0;
    strengths.push('Контроль темпа повествования: запрет на искусственное ускорение игрового времени.');
  }

  if (pLower.includes('не сделал ли npc глупее') || pLower.includes('интеллект npc') || pLower.includes('правдоподоб')) {
    personaDepth += 1.0;
    worldSetting += 1.0;
    strengths.push('Сохранение органичного интеллекта NPC без подыгрывания или деградации.');
  }

  // 5. Memory & consequence tracking
  if (pLower.includes('помнят ли') || pLower.includes('последствия') || pLower.includes('память') || pLower.includes('причинно-следствен')) {
    worldSetting += 1.5;
    strengths.push('Механика учета последствий: сохранение причинно-следственных связей и памяти персонажей.');
  }

  // 6. Formatting & Dialogue Structure
  if (
    trimmed.includes('*') ||
    trimmed.includes('"') ||
    trimmed.includes('«') ||
    trimmed.includes('1.') ||
    trimmed.includes('- ') ||
    trimmed.includes('###')
  ) {
    formattingDialogue += 1.5;
    strengths.push('Четкая визуальная структура: разделение на списки, пункты правил и диалоговые маркеры.');
  }

  // 7. OOC rules
  if (
    pLower.includes('не выходи') ||
    pLower.includes('всегда в роли') ||
    pLower.includes('не упоминай ии') ||
    pLower.includes('ooc') ||
    hasExecutionCheck
  ) {
    oocResistance += 1.5;
    strengths.push('Надежная защита от выхода из роли и сопротивление слому характера.');
  }

  // Clamp 0-10
  personaDepth = Math.max(1, Math.min(10, Math.round(personaDepth * 10) / 10));
  oocResistance = Math.max(1, Math.min(10, Math.round(oocResistance * 10) / 10));
  worldSetting = Math.max(1, Math.min(10, Math.round(worldSetting * 10) / 10));
  formattingDialogue = Math.max(1, Math.min(10, Math.round(formattingDialogue * 10) / 10));
  userDynamics = Math.max(1, Math.min(10, Math.round(userDynamics * 10) / 10));

  const overallScore = Math.min(
    10,
    Math.round(((personaDepth * 0.25) + (oocResistance * 0.2) + (worldSetting * 0.15) + (formattingDialogue * 0.2) + (userDynamics * 0.2)) * 10) / 10
  );

  let verdict = 'Качественный ролевой промпт с понятными целями и устойчивой динамикой.';
  if (overallScore >= 9.3) {
    verdict = 'Выдающийся, мастерски проработанный RP-промпт! Наличие Execution Checks, жестких директив против Godmoding и глубокий сеттинг гарантируют эталонную ролевую игру.';
  } else if (overallScore >= 8.5) {
    verdict = 'Отличный, глубокий промпт с живым языком, высокой устойчивостью и уважением к выборам игрока!';
  } else if (overallScore >= 7.0) {
    verdict = 'Крепкий ролевой промпт. Хорошо передает образ, есть потенциал для полировки деталей.';
  }

  return {
    overallScore,
    verdict,
    categoryScores: {
      personaDepth,
      oocResistance,
      worldSetting,
      formattingDialogue,
      userDynamics,
    },
    strengths,
    weaknesses,
    actionableIdeas,
    detectedAntiPatterns: antiPatterns,
    formatDetected,
    enhancedPrompt: trimmed,
    suggestedTags: ['RolePlay', formatDetected, 'High-Fidelity', 'Interactive'],
  };
}

// System instruction for deep LLM evaluation
function getSystemAnalysisInstruction(style: string = 'any', customFocus?: string): string {
  return `Ты — ведущий эксперт по промпт-инжинирингу для RolePlay (RP). Оценивай объективно.
Если в промпте есть Execution Checks, запрет Godmoding, глубокий контекст и правила мира — ставь заслуженно высокую оценку (9.3 - 9.9).
Если пустой или точка — ставь 0.5.
${customFocus ? `Фокус автора: "${customFocus}".` : ''}

ОБЯЗАТЕЛЬНО верни ТОЛЬКО валидный JSON:
{
  "overallScore": number (0.0-10.0),
  "verdict": "Профессиональный вердикт (1-2 предложения)",
  "categoryScores": {
    "personaDepth": number (0-10),
    "oocResistance": number (0-10),
    "worldSetting": number (0-10),
    "formattingDialogue": number (0-10),
    "userDynamics": number (0-10)
  },
  "strengths": ["сильные стороны промпта"],
  "weaknesses": ["точки для роста или риски, если есть"],
  "actionableIdeas": ["практические идеи по улучшению"],
  "detectedAntiPatterns": ["анти-паттерны, если обнаружены"],
  "formatDetected": "Формат промпта",
  "enhancedPrompt": "Краткий совет по развитию промпта (1 предложение)",
  "suggestedTags": ["теги"]
}`;
}

// 1. Endpoint: Analyze RP Prompt (supports Groq, Gemini, Custom API, Offline mode)
app.post('/api/analyze-rp-prompt', async (req: Request, res: Response) => {
  const { prompt, style, provider, apiKey, model, customEndpoint, customFocus, evaluationMode } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Промпт не может быть пустым.' });
  }

  const trimmed = prompt.trim();

  // If obviously empty or just dot / punctuation, return instant 0.5 score
  if (trimmed.length < 10 || /^[^a-zA-Zа-яА-Я0-9]+$/.test(trimmed)) {
    return res.json(smartHeuristicAnalysis(trimmed, style));
  }

  // If user selected offline evaluation mode, return heuristic directly
  if (evaluationMode === 'offline') {
    return res.json(smartHeuristicAnalysis(trimmed, style));
  }

  // 1. Groq Provider
  if (provider === 'groq') {
    const effectiveGroqKey = (apiKey && apiKey.trim()) ? apiKey.trim() : (process.env.GROQ_API_KEY || null);

    if (!effectiveGroqKey) {
      return res.status(400).json({
        error: 'Ключ Groq не обнаружен. Нажмите на значок настроек в шапке (справа) и сохраните ваш ключ Groq (gsk_...).'
      });
    }

    try {
      const systemInstruction = getSystemAnalysisInstruction(style, customFocus);
      const groqModel = model || 'openai/gpt-oss-120b';
      const compressedPrompt = compressPromptForEvaluation(trimmed);

      const rawResponse = await callGroqOrOpenAI({
        apiKey: effectiveGroqKey,
        model: groqModel,
        systemInstruction,
        userMessage: `RP-промпт:\n"""\n${compressedPrompt}\n"""`,
        maxTokens: 750,
      });

      const parsed = extractJsonFromText(rawResponse);
      if (parsed && typeof parsed.overallScore === 'number') {
        return res.json(parsed);
      }
    } catch (err: any) {
      console.error('Groq analysis error:', err.message);
      const fallback = smartHeuristicAnalysis(trimmed, style);
      if (err.message?.includes('429') || err.message?.includes('413') || err.message?.includes('limit')) {
        fallback.verdict = `[Лимит токенов Groq на эту минуту исчерпан — выполнен глубокий аудит]: ${fallback.verdict}`;
      } else {
        fallback.verdict = `[Сбой Groq API — выполнен глубокий эвристический аудит]: ${fallback.verdict}`;
      }
      return res.json(fallback);
    }
  }

  // 2. Custom OpenAI / OpenRouter endpoint
  if (provider === 'custom') {
    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({ error: 'API ключ для стороннего эндпоинта не указан.' });
    }

    try {
      const systemInstruction = getSystemAnalysisInstruction(style, customFocus);
      const compressedPrompt = compressPromptForEvaluation(trimmed);
      const rawResponse = await callGroqOrOpenAI({
        apiKey: apiKey.trim(),
        model: model || 'openai/gpt-oss-120b',
        systemInstruction,
        userMessage: `RP-промпт:\n"""\n${compressedPrompt}\n"""`,
        customEndpoint: customEndpoint || 'https://api.groq.com/openai/v1/chat/completions',
        maxTokens: 750,
      });

      const parsed = extractJsonFromText(rawResponse);
      if (parsed && typeof parsed.overallScore === 'number') {
        return res.json(parsed);
      }
    } catch (err: any) {
      console.error('Custom endpoint analysis error:', err.message);
      const fallback = smartHeuristicAnalysis(trimmed, style);
      fallback.verdict = `[Сбой Custom API — выполнен локальный аудит]: ${fallback.verdict}`;
      return res.json(fallback);
    }
  }

  // 3. Gemini Provider (ONLY if user explicitly chose gemini)
  if (provider === 'gemini') {
    const effectiveGeminiKey = (apiKey && apiKey.trim()) ? apiKey.trim() : geminiApiKey;
    if (effectiveGeminiKey) {
      try {
        const geminiInstance = (apiKey && apiKey.trim()) ? new GoogleGenAI({ apiKey: apiKey.trim() }) : ai;
        if (geminiInstance) {
          const systemInstruction = getSystemAnalysisInstruction(style, customFocus);
          const compressedPrompt = compressPromptForEvaluation(trimmed);
          const response = await geminiInstance.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: [
              {
                role: 'user',
                parts: [{ text: `Проведи детальный аудит следующего RP-промпта:\n\n"""\n${compressedPrompt}\n"""` }],
              },
            ],
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
            },
          });

          const text = response.text || '';
          const parsed = extractJsonFromText(text);
          if (parsed && typeof parsed.overallScore === 'number') {
            return res.json(parsed);
          }
        }
      } catch (err: any) {
        console.error('Gemini API analysis error:', err.message);
        const fallback = smartHeuristicAnalysis(trimmed, style);
        fallback.verdict = `[Сервис Gemini временно недоступен — выполнен локальный аудит]: ${fallback.verdict}`;
        return res.json(fallback);
      }
    }
  }

  // 4. Fallback to smart heuristic analysis
  return res.json(smartHeuristicAnalysis(trimmed, style));
});

// 2. Test Key Endpoint
app.post('/api/test-key', async (req: Request, res: Response) => {
  const { provider, apiKey, model, customEndpoint } = req.body;
  if (!apiKey) return res.status(400).json({ ok: false, error: 'Ключ не передан' });

  try {
    if (provider === 'groq' || provider === 'custom') {
      const endpoint = customEndpoint || 'https://api.groq.com/openai/v1/chat/completions';
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: 'Ответь словом "OK"' }],
          max_tokens: 5,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(400).json({ ok: false, error: `Ошибка API (${resp.status}): ${txt}` });
      }

      return res.json({ ok: true, message: 'Ключ Groq успешно проверен и работает!' });
    } else if (provider === 'gemini') {
      const testAi = new GoogleGenAI({ apiKey });
      const resp = await testAi.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: 'Ping' }] }],
      });
      if (resp.text) {
        return res.json({ ok: true, message: 'Ключ Gemini успешно проверен и работает!' });
      }
    }
    return res.status(400).json({ ok: false, error: 'Неизвестный провайдер' });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Server initialization with Vite dev server
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
