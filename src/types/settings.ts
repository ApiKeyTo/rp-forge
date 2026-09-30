export type AIProvider = 'groq' | 'gemini' | 'custom';

export type RPStyle = 
  | 'any'
  | 'first_person'
  | 'second_person'
  | 'narrator_gm'
  | 'tavern_card'
  | 'system_prompt';

export type EvaluationMode = 'ai' | 'offline';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  rpStyle: RPStyle;
  evaluationMode: EvaluationMode;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'groq',
  apiKey: '',
  model: 'openai/gpt-oss-120b',
  customEndpoint: '',
  rpStyle: 'any',
  evaluationMode: 'ai',
};
