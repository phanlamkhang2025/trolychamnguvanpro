export type AiProvider = 'gemini' | 'agent-platform';

export type AiErrorType =
  | 'NO_API_KEY'
  | 'INVALID_API_KEY'
  | 'PERMISSION_DENIED'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMIT'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'INVALID_ARGUMENT'
  | 'BAD_RESPONSE'
  | 'FILE_TOO_LARGE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_AGENT_PLATFORM_MODEL = 'gemini-3.6-flash';

// Follows the 24/10/2026 note in api.md: deprecated gemini-3.5-flash and gemini-3.7-flash are left out,
// and the 2.5 line stays last because new API keys may get 403/404 on it.
export const GEMINI_FALLBACK_MODELS = [
  DEFAULT_GEMINI_MODEL,
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
];

export const AGENT_PLATFORM_FALLBACK_MODELS = [
  DEFAULT_AGENT_PLATFORM_MODEL,
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

export const getProviderModels = (provider: AiProvider): string[] =>
  provider === 'agent-platform' ? AGENT_PLATFORM_FALLBACK_MODELS : GEMINI_FALLBACK_MODELS;

export const getDefaultModel = (provider: AiProvider): string =>
  provider === 'agent-platform' ? DEFAULT_AGENT_PLATFORM_MODEL : DEFAULT_GEMINI_MODEL;

// Selected model first, then the provider's chain without duplicates
export const getOrderedModels = (provider: AiProvider, selectedModel?: string): string[] => {
  const preferred = selectedModel?.trim() || getDefaultModel(provider);
  return [preferred, ...getProviderModels(provider)].filter(
    (model, index, models) => models.indexOf(model) === index
  );
};

// Accepts legacy AIza... keys and newer AQ... / AQ. keys
export const GOOGLE_AI_API_KEY_PATTERN = /^(?:AIza|AQ)[\w.\-]{20,}$/;

export const isValidGoogleAiApiKey = (key: string): boolean =>
  GOOGLE_AI_API_KEY_PATTERN.test(key.trim());

// Errors tied to one model (per-model free quota, restricted model, overload): worth trying the next model
export const MODEL_FALLBACK_ERROR_TYPES: AiErrorType[] = [
  'QUOTA_EXCEEDED',
  'RATE_LIMIT',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'SERVER_ERROR',
  'INVALID_ARGUMENT',
  'BAD_RESPONSE',
];
