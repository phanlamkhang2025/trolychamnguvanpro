import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Trash2,
} from 'lucide-react';
import { AIService } from '../services/aiService';
import { AiProvider, getDefaultModel, getProviderModels, isValidGoogleAiApiKey } from '../services/aiConfig';
import { ApiKeyStore } from '../services/apiKeyStore';

interface ApiKeySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const PROVIDERS: { id: AiProvider; name: string; hint: string; keyUrl: string; keyLabel: string }[] = [
  {
    id: 'gemini',
    name: 'Gemini API',
    hint: 'Key từ Google AI Studio, có gói miễn phí. Phù hợp với đa số giáo viên.',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyLabel: 'Lấy Gemini API key',
  },
  {
    id: 'agent-platform',
    name: 'Agent Platform API',
    hint: 'Key từ dự án Google Cloud, cần bật API và billing.',
    keyUrl: 'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/api-keys',
    keyLabel: 'Hướng dẫn lấy Agent Platform API key',
  },
];

const MODEL_INFO: Record<string, { name: string; hint: string }> = {
  'gemini-3.8-flash': { name: 'Gemini 3.8 Flash', hint: 'Mạnh nhất dòng Flash, chấm bài tốt' },
  'gemini-3.6-flash': { name: 'Gemini 3.6 Flash', hint: 'Cân bằng tốc độ và chất lượng' },
  'gemini-3.5-flash-lite': { name: 'Gemini 3.5 Flash-Lite', hint: 'Rất nhanh, chịu tải cao, chi phí thấp' },
  'gemini-3.1-flash-lite': { name: 'Gemini 3.1 Flash-Lite', hint: 'Nhẹ, dùng khi các model khác bận' },
  'gemini-flash-latest': { name: 'Gemini Flash (mới nhất)', hint: 'Luôn trỏ tới bản Flash ổn định mới nhất' },
  'gemini-2.5-flash': { name: 'Gemini 2.5 Flash', hint: 'Key tạo mới có thể không dùng được' },
  'gemini-2.5-flash-lite': { name: 'Gemini 2.5 Flash-Lite', hint: 'Key tạo mới có thể không dùng được' },
};

const emptyKeys = (): Record<AiProvider, string> => ({ gemini: '', 'agent-platform': '' });

export const ApiKeySettingsModal: React.FC<ApiKeySettingsModalProps> = ({
  isOpen,
  onClose,
  onChanged,
}) => {
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const [keys, setKeys] = useState(emptyKeys);
  const [models, setModels] = useState<Record<AiProvider, string>>({
    gemini: getDefaultModel('gemini'),
    'agent-platform': getDefaultModel('agent-platform'),
  });
  const [showKey, setShowKey] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setProvider(ApiKeyStore.getProvider());
    setKeys({
      gemini: ApiKeyStore.getApiKey('gemini'),
      'agent-platform': ApiKeyStore.getApiKey('agent-platform'),
    });
    setModels({
      gemini: ApiKeyStore.getModel('gemini'),
      'agent-platform': ApiKeyStore.getModel('agent-platform'),
    });
    setShowKey(false);
    setStatus(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const providerInfo = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];
  const currentKey = keys[provider].trim();

  const handleSelectProvider = (next: AiProvider) => {
    setProvider(next);
    setShowKey(false);
    setStatus(null);
  };

  const handleCheckKey = async () => {
    if (!isValidGoogleAiApiKey(currentKey)) {
      setStatus({ ok: false, text: 'API Key phải bắt đầu bằng AIza... hoặc AQ... và không chứa dấu cách.' });
      return;
    }

    setIsChecking(true);
    setStatus(null);
    const result = await AIService.validateApiKey(currentKey, provider, models[provider]);
    setIsChecking(false);
    setStatus({ ok: result.ok, text: result.message });

    if (result.workingModel) {
      setModels((prev) => ({ ...prev, [provider]: result.workingModel as string }));
    }
  };

  const handleClearKey = () => {
    ApiKeyStore.clearApiKey(provider);
    setKeys((prev) => ({ ...prev, [provider]: '' }));
    setStatus({ ok: true, text: `Đã xóa key ${providerInfo.name} khỏi trình duyệt này.` });
    onChanged();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentKey) {
      setStatus({ ok: false, text: 'Vui lòng nhập API Key trước khi lưu.' });
      return;
    }
    if (!isValidGoogleAiApiKey(currentKey)) {
      setStatus({ ok: false, text: 'API Key phải bắt đầu bằng AIza... hoặc AQ... và không chứa dấu cách.' });
      return;
    }

    ApiKeyStore.saveSettings(provider, currentKey, models[provider]);
    onChanged();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-modal-title"
        className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200"
      >
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-600 rounded-lg">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 id="api-key-modal-title" className="font-bold text-base">
                Cài đặt API Key
              </h3>
              <p className="text-xs text-slate-300">Cần có API Key để AI chấm bài và đọc chữ viết tay</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5 text-slate-800 text-sm overflow-y-auto">
          {/* Provider is always a manual choice, never guessed from the key prefix */}
          <fieldset>
            <legend className="block text-xs font-semibold text-slate-600 mb-1.5">Dịch vụ AI</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={provider === p.id}
                  onClick={() => handleSelectProvider(p.id)}
                  className={`text-left p-3 rounded-xl border-2 transition-colors cursor-pointer ${
                    provider === p.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className="block font-bold text-slate-900">{p.name}</span>
                  <span className="block text-xs text-slate-600 mt-0.5">{p.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="api-key-input" className="block text-xs font-semibold text-slate-600 mb-1">
              API Key của {providerInfo.name}
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                value={keys[provider]}
                onChange={(e) => {
                  const value = e.target.value;
                  setKeys((prev) => ({ ...prev, [provider]: value }));
                  setStatus(null);
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder="AIza... hoặc AQ..."
                className="w-full pl-3 pr-10 py-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowKey((prev) => !prev)}
                aria-label={showKey ? 'Ẩn API Key' : 'Hiện API Key'}
                className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <a
              href={providerInfo.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-blue-700 hover:underline"
            >
              <span>{providerInfo.keyLabel}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <fieldset>
            <legend className="block text-xs font-semibold text-slate-600 mb-1.5">Model ưu tiên</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {getProviderModels(provider).map((model) => (
                <button
                  key={model}
                  type="button"
                  aria-pressed={models[provider] === model}
                  onClick={() => setModels((prev) => ({ ...prev, [provider]: model }))}
                  className={`text-left p-2.5 rounded-lg border-2 transition-colors cursor-pointer ${
                    models[provider] === model
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs text-slate-900">{MODEL_INFO[model]?.name || model}</span>
                    {model === getDefaultModel(provider) && (
                      <span className="px-1.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                        Mặc định
                      </span>
                    )}
                  </span>
                  <span className="block text-[11px] text-slate-600 mt-0.5">{MODEL_INFO[model]?.hint}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Khi model này bận hoặc hết lượt, app tự chuyển sang model khác trong danh sách.
            </p>
          </fieldset>

          {status && (
            <div
              role="status"
              className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                status.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {status.ok ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span>{status.text}</span>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Key chỉ lưu trong trình duyệt của máy này và chỉ được gửi thẳng tới Google khi gọi AI. Dùng máy chung thì nhớ
            bấm “Xóa key” sau khi xong việc.
          </p>

          <div className="flex flex-wrap justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleClearKey}
              disabled={!ApiKeyStore.getApiKey(provider) && !currentKey}
              className="mr-auto inline-flex items-center gap-1.5 px-3 py-2 border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa key</span>
            </button>
            <button
              type="button"
              onClick={handleCheckKey}
              disabled={isChecking || !currentKey}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isChecking && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isChecking ? 'Đang kiểm tra...' : 'Kiểm tra key'}</span>
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium shadow-sm cursor-pointer"
            >
              Lưu cấu hình
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
