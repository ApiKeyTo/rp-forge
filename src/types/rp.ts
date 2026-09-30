export interface RPCategoryScores {
  personaDepth: number;
  oocResistance: number;
  worldSetting: number;
  formattingDialogue: number;
  userDynamics: number;
}

export interface RPAnalysisData {
  overallScore: number;
  verdict: string;
  categoryScores: RPCategoryScores;
  strengths: string[];
  weaknesses: string[];
  actionableIdeas: string[];
  detectedAntiPatterns: string[];
  formatDetected: string;
  enhancedPrompt: string;
  suggestedTags: string[];
}

export interface RPAuditHistoryItem {
  id: string;
  versionNumber: number; // 1, 2, 3...
  versionName: string; // "v1", "v2", "v3"
  customLabel?: string;
  timestamp: number;
  promptText: string;
  promptSnippet: string;
  overallScore: number;
  scoreDelta?: number; // e.g. +1.4 or -0.5 vs previous run
  auditResult: RPAnalysisData;
  provider: string;
  model: string;
}
