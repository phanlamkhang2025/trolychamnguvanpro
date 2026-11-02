import { AiProvider, getDefaultModel, getProviderModels } from './aiConfig';

const API_KEY_STORAGE: Record<AiProvider, string> = {
  gemini: 'gemini_api_key',
  'agent-platform': 'agent_platform_api_key',
};
const MODEL_STORAGE: Record<AiProvider, string> = {
  gemini: 'gemini_model_id_v38',
  'agent-platform': 'agent_platform_model_id',
};
const PROVIDER_STORAGE = 'google_ai_provider';
const PROVIDER_SOURCE_STORAGE = 'google_ai_provider_selection_source';
const LEGACY_MODEL_STORAGE = 'GEMINI_MODEL_ID';

const readItem = (key: string): string => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const writeItem = (key: string, value: string) => {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('Không thể lưu cấu hình API vào trình duyệt:', (err as Error)?.name);
  }
};

writeItem(LEGACY_MODEL_STORAGE, '');

export const ApiKeyStore = {
  // Only an explicit, manual choice counts; older 'vertex' values fall back to Gemini
  getProvider(): AiProvider {
    return readItem(PROVIDER_STORAGE) === 'agent-platform' ? 'agent-platform' : 'gemini';
  },

  getApiKey(provider: AiProvider = ApiKeyStore.getProvider()): string {
    return readItem(API_KEY_STORAGE[provider]);
  },

  getModel(provider: AiProvider = ApiKeyStore.getProvider()): string {
    const saved = readItem(MODEL_STORAGE[provider]);
    return getProviderModels(provider).includes(saved) ? saved : getDefaultModel(provider);
  },

  saveSettings(provider: AiProvider, apiKey: string, model: string) {
    writeItem(PROVIDER_STORAGE, provider);
    writeItem(PROVIDER_SOURCE_STORAGE, 'manual');
    writeItem(API_KEY_STORAGE[provider], apiKey.trim());
    writeItem(MODEL_STORAGE[provider], model);
  },

  clearApiKey(provider: AiProvider) {
    writeItem(API_KEY_STORAGE[provider], '');
  },
};
