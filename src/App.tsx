import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, GraduationCap, KeyRound, Plus, UserRound } from 'lucide-react';
import { AuditAction, AuditLog, Exam, GradingResult, Submission, User } from './types';
import { StorageService } from './services/storage';
import { ApiKeyStore } from './services/apiKeyStore';
import { setModelFallbackListener } from './services/aiService';
import { gradeSubmission, getLatestResult, hasAnswerKey } from './services/grading';
import { useGradingQueue } from './hooks/useGradingQueue';
import { ExamStep } from './components/steps/ExamStep';
import { SubmissionsStep } from './components/steps/SubmissionsStep';
import { GradingStep } from './components/steps/GradingStep';
import { ResultsStep } from './components/steps/ResultsStep';
import { StorageInfoModal } from './components/StorageInfoModal';
import { ApiKeySettingsModal } from './components/ApiKeySettingsModal';
import { Modal, buttonPrimary, buttonSecondary, inputClass, labelClass } from './components/ui';

type Step = 'exam' | 'submissions' | 'grading' | 'results';

const CURRENT_EXAM_KEY = 'gv_van_current_exam';

const readCurrentExamId = (): string | null => {
  try {
    return localStorage.getItem(CURRENT_EXAM_KEY);
  } catch {
    return null;
  }
};

const ProfileModal: React.FC<{ user: User; onSave: (user: User) => void; onClose: () => void }> = ({
  user,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(user.name);
  const [school, setSchool] = useState(user.school);

  return (
    <Modal title="Thông tin giáo viên" labelledBy="profile-title" onClose={onClose}>
      <form
        className="p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ name: name.trim(), school: school.trim() });
        }}
      >
        <p className="text-sm text-slate-600">Tên và trường được in trên phiếu chấm và ghi vào lịch sử duyệt điểm.</p>
        <div>
          <label htmlFor="profile-name" className={labelClass}>
            Họ và tên
          </label>
          <input id="profile-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="profile-school" className={labelClass}>
            Trường
          </label>
          <input id="profile-school" className={inputClass} value={school} onChange={(e) => setSchool(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={buttonSecondary}>
            Hủy
          </button>
          <button type="submit" className={buttonPrimary}>
            Lưu
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default function App() {
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [gradingResults, setGradingResults] = useState<GradingResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [currentUser, setCurrentUser] = useState<User>(StorageService.getCurrentUser());

  const [currentExamId, setCurrentExamId] = useState<string | null>(readCurrentExamId);
  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [step, setStep] = useState<Step>('exam');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);

  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(() => !ApiKeyStore.getApiKey());
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isStorageInfoOpen, setIsStorageInfoOpen] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(() => Boolean(ApiKeyStore.getApiKey()));
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const refreshAllData = useCallback(() => {
    setExams(StorageService.getExams());
    setSubmissions(StorageService.getSubmissions());
    setGradingResults(StorageService.getGradingResults());
    setAuditLogs(StorageService.getAuditLogs());
  }, []);

  useEffect(() => {
    setModelFallbackListener((event) => {
      setFallbackNotice(
        event.type === 'switch'
          ? `Đang tự động chuyển từ ${event.from} sang ${event.to} (do ${event.from} ${event.reason})...`
          : null
      );
    });
    return () => setModelFallbackListener(null);
  }, []);

  const teacherName = currentUser.name || 'Giáo viên';

  const addAudit = useCallback(
    (
      action: AuditAction,
      oldScore: number | undefined,
      newScore: number,
      details: string,
      submissionId: string,
      gradingResultId: string
    ) => {
      StorageService.addAuditLog({
        submissionId,
        gradingResultId,
        actor: teacherName,
        actorRole: 'Giáo viên bộ môn',
        action,
        oldScore,
        newScore,
        details,
      });
      setAuditLogs(StorageService.getAuditLogs());
    },
    [teacherName]
  );

  const gradeOne = useCallback(
    async (submission: Submission) => {
      const exam = StorageService.getExams().find((e) => e.id === submission.examId);
      if (!exam) throw new Error('Không tìm thấy đề của bài này.');

      const previous = getLatestResult(StorageService.getGradingResults(), submission.id);
      const result = await gradeSubmission(submission, exam, previous);

      // Deleted while the AI was still working on it
      if (!StorageService.getSubmissions().some((s) => s.id === submission.id)) return;

      StorageService.saveGradingResult(result);
      addAudit(
        previous ? 'CHẤM_LẠI' : 'CHẤM_LẦN_ĐẦU',
        previous?.finalTeacherScore ?? previous?.aiSuggestedScore,
        result.aiSuggestedScore,
        previous ? `AI chấm lại, lần thứ ${result.version}.` : 'AI chấm lần đầu.',
        submission.id,
        result.id
      );
      refreshAllData();
    },
    [addAudit, refreshAllData]
  );

  const openApiKeySettings = useCallback(() => setIsApiKeyModalOpen(true), []);
  const { queue, startGrading, stopGrading } = useGradingQueue(gradeOne, openApiKeySettings);

  const isQueueRunningRef = useRef(false);
  isQueueRunningRef.current = queue.isRunning;

  // Loads the data once, then opens where the teacher can continue working
  useEffect(() => {
    StorageService.setErrorListener(setStorageNotice);
    StorageService.init()
      .then(() => {
        refreshAllData();
        const storedExams = StorageService.getExams();
        const savedId = readCurrentExamId();
        const exam = storedExams.find((e) => e.id === savedId) || storedExams[0];
        setCurrentExamId(exam?.id ?? null);
        if (exam) {
          const hasWork = StorageService.getSubmissions().some((s) => s.examId === exam.id);
          setStep(hasWork ? 'grading' : 'submissions');
        }
      })
      .finally(() => setIsStorageReady(true));

    const warnIfUnsaved = (e: BeforeUnloadEvent) => {
      if (StorageService.hasPendingWrites() || isQueueRunningRef.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', warnIfUnsaved);
    return () => {
      StorageService.setErrorListener(null);
      window.removeEventListener('beforeunload', warnIfUnsaved);
    };
  }, [refreshAllData]);

  useEffect(() => {
    try {
      if (currentExamId) localStorage.setItem(CURRENT_EXAM_KEY, currentExamId);
    } catch {
      // Only a convenience: the first exam opens instead next time
    }
  }, [currentExamId]);

  const currentExam = isCreatingExam ? null : exams.find((e) => e.id === currentExamId) ?? null;

  const examSubmissions = useMemo(
    () => submissions.filter((s) => s.examId === currentExam?.id),
    [submissions, currentExam?.id]
  );

  const selectExam = (id: string) => {
    setIsCreatingExam(false);
    setCurrentExamId(id);
    setSelectedSubmissionId(null);
    const hasWork = submissions.some((s) => s.examId === id);
    setStep(hasWork ? 'grading' : 'submissions');
  };

  const startNewExam = () => {
    setIsCreatingExam(true);
    setSelectedSubmissionId(null);
    setStep('exam');
  };

  const handleSaveExam = (exam: Exam, goToNextStep: boolean) => {
    StorageService.saveExam(exam);
    refreshAllData();
    if (goToNextStep) {
      setIsCreatingExam(false);
      setCurrentExamId(exam.id);
      setStep('submissions');
    }
  };

  const handleDeleteExam = (id: string) => {
    StorageService.deleteExam(id);
    refreshAllData();
    const next = StorageService.getExams()[0];
    setCurrentExamId(next?.id ?? null);
    setSelectedSubmissionId(null);
    setStep('exam');
  };

  const handleSaveSubmission = async (submission: Submission) => {
    const saved = await StorageService.saveSubmission(submission);
    refreshAllData();
    return saved;
  };

  const handleDeleteSubmission = (id: string) => {
    StorageService.deleteSubmission(id);
    refreshAllData();
    if (selectedSubmissionId === id) setSelectedSubmissionId(null);
  };

  const handleSaveResult = (result: GradingResult) => {
    StorageService.saveGradingResult(result);
    refreshAllData();
  };

  const openSubmission = (id: string) => {
    setSelectedSubmissionId(id);
    setStep('grading');
  };

  if (!isStorageReady) {
    return (
      <div role="status" className="min-h-screen flex items-center justify-center text-sm text-slate-600">
        Đang tải dữ liệu...
      </div>
    );
  }

  const notGraded = examSubmissions.filter((s) => s.status === 'chua_cham').length;
  const waiting = examSubmissions.filter((s) => s.status === 'cho_duyet').length;
  const approved = examSubmissions.filter((s) => s.status === 'da_duyet').length;

  const steps: { id: Step; label: string; detail: string; isDone: boolean }[] = [
    {
      id: 'exam',
      label: 'Đề & đáp án',
      detail: currentExam ? (hasAnswerKey(currentExam) ? 'Đã có đáp án' : 'Chưa có đáp án') : 'Tạo đề',
      isDone: Boolean(currentExam && hasAnswerKey(currentExam)),
    },
    {
      id: 'submissions',
      label: 'Bài làm',
      detail: examSubmissions.length > 0 ? `${examSubmissions.length} bài` : 'Chưa có bài',
      isDone: examSubmissions.length > 0,
    },
    {
      id: 'grading',
      label: 'Chấm & duyệt',
      detail:
        examSubmissions.length === 0
          ? 'Chưa có bài'
          : notGraded + waiting === 0
            ? 'Đã duyệt hết'
            : [notGraded > 0 && `${notGraded} chưa chấm`, waiting > 0 && `${waiting} chờ duyệt`].filter(Boolean).join(', '),
      isDone: examSubmissions.length > 0 && approved === examSubmissions.length,
    },
    {
      id: 'results',
      label: 'Kết quả',
      detail: examSubmissions.length > 0 ? `${approved}/${examSubmissions.length} đã duyệt` : 'Chưa có điểm',
      isDone: false,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col text-slate-900">
      {fallbackNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 inset-x-0 z-40 bg-amber-100 border-b border-amber-300 text-amber-950 text-sm font-medium text-center px-4 py-2 pointer-events-none"
        >
          {fallbackNotice}
        </div>
      )}

      {storageNotice && (
        <div
          role="alert"
          className="fixed bottom-0 inset-x-0 z-40 bg-rose-100 border-t border-rose-300 text-rose-950 text-sm font-medium text-center px-4 py-2"
        >
          {storageNotice}
        </div>
      )}

      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5 mr-2">
            <span className="w-9 h-9 rounded-lg bg-blue-700 text-white flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </span>
            <h1 className="font-bold text-slate-900 whitespace-nowrap">Trợ lý Chấm Văn</h1>
          </div>

          {exams.length > 0 && (
            <div className="flex items-center gap-2 flex-1 min-w-64">
              <label htmlFor="current-exam" className="text-sm text-slate-600 whitespace-nowrap">
                Đề đang chấm
              </label>
              <select
                id="current-exam"
                className={`${inputClass} flex-1 min-w-0 font-semibold`}
                value={isCreatingExam ? '' : currentExam?.id ?? ''}
                onChange={(e) => selectExam(e.target.value)}
              >
                {isCreatingExam && <option value="">Đề mới</option>}
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button type="button" onClick={startNewExam} className={buttonSecondary}>
              <Plus className="w-4 h-4" />
              Đề mới
            </button>
            <button type="button" onClick={() => setIsProfileOpen(true)} className={buttonSecondary}>
              <UserRound className="w-4 h-4" />
              <span className="max-w-32 truncate">{teacherName}</span>
            </button>
            <div className="flex flex-col items-end">
              <button type="button" onClick={openApiKeySettings} className={buttonSecondary}>
                <KeyRound className={`w-4 h-4 ${hasStoredKey ? 'text-emerald-700' : 'text-rose-600'}`} />
                API Key {hasStoredKey ? '(đã có)' : '(chưa có)'}
              </button>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-rose-700 hover:underline mt-0.5"
              >
                Lấy API key để sử dụng app
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* The four steps are always about the exam chosen above */}
      <nav aria-label="Các bước chấm bài" className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <ol className="max-w-[1500px] mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => {
            const isActive = step === item.id;
            const isDisabled = item.id !== 'exam' && !currentExam;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={isDisabled}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => setStep(item.id)}
                  className={`w-full h-full flex items-center gap-2.5 px-2 py-2.5 text-left border-b-2 transition-colors ${
                    isActive ? 'border-blue-700' : 'border-transparent hover:bg-slate-50'
                  } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
                      isActive
                        ? 'bg-blue-700 text-white'
                        : item.isDone
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.isDone && !isActive ? <Check className="w-4 h-4" aria-label="Xong" /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${isActive ? 'text-blue-800' : 'text-slate-900'}`}>
                      {item.label}
                    </span>
                    <span className="block text-xs text-slate-600 truncate">{item.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 py-6">
        {step === 'exam' && (
          <ExamStep
            key={currentExam?.id ?? 'new'}
            exam={currentExam}
            defaultSchool={currentUser.school}
            submissionCount={examSubmissions.length}
            canCancel={exams.length > 0}
            onSave={handleSaveExam}
            onDelete={handleDeleteExam}
            onCancel={() => {
              setIsCreatingExam(false);
              setStep('submissions');
            }}
          />
        )}

        {step === 'submissions' && currentExam && (
          <SubmissionsStep
            exam={currentExam}
            submissions={examSubmissions}
            results={gradingResults}
            gradingId={queue.currentId}
            onSaveSubmission={handleSaveSubmission}
            onDeleteSubmission={handleDeleteSubmission}
            onOpenSubmission={openSubmission}
            onNext={() => setStep('grading')}
          />
        )}

        {step === 'grading' && currentExam && (
          <GradingStep
            exam={currentExam}
            submissions={examSubmissions}
            results={gradingResults}
            auditLogs={auditLogs}
            queue={queue}
            teacherName={teacherName}
            selectedId={selectedSubmissionId}
            onSelect={setSelectedSubmissionId}
            onStartGrading={startGrading}
            onStopGrading={stopGrading}
            onSaveResult={handleSaveResult}
            onAudit={addAudit}
            onGoToSubmissions={() => setStep('submissions')}
            onGoToExam={() => setStep('exam')}
            onGoToResults={() => setStep('results')}
          />
        )}

        {step === 'results' && currentExam && (
          <ResultsStep
            exam={currentExam}
            submissions={examSubmissions}
            results={gradingResults}
            teacherName={teacherName}
            onOpenSubmission={openSubmission}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <p>AI chỉ đề xuất điểm. Điểm chính thức do giáo viên duyệt.</p>
          <button
            type="button"
            onClick={() => setIsStorageInfoOpen(true)}
            className="underline hover:text-slate-900 cursor-pointer"
          >
            Dữ liệu được lưu trên trình duyệt này
          </button>
        </div>
      </footer>

      <ApiKeySettingsModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onChanged={() => setHasStoredKey(Boolean(ApiKeyStore.getApiKey()))}
      />

      <StorageInfoModal isOpen={isStorageInfoOpen} onClose={() => setIsStorageInfoOpen(false)} />

      {isProfileOpen && (
        <ProfileModal
          user={currentUser}
          onClose={() => setIsProfileOpen(false)}
          onSave={(user) => {
            StorageService.saveCurrentUser(user);
            setCurrentUser(user);
            setIsProfileOpen(false);
          }}
        />
      )}
    </div>
  );
}
