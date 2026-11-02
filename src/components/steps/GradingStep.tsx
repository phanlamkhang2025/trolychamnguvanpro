import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Download,
  Lightbulb,
  Loader2,
  Printer,
  RotateCcw,
  Square,
  Undo2,
} from 'lucide-react';
import { AuditAction, AuditLog, CriterionGrade, Exam, GradingResult, Submission } from '../../types';
import { GradingQueueState } from '../../hooks/useGradingQueue';
import { attachmentHref } from '../../services/storage';
import { isImageFile, isPdfFile } from '../../services/files';
import {
  criterionScore,
  effectiveScore,
  formatScore,
  getLatestResult,
  hasAnswerKey,
  hasExamPrompt,
  sumCriteria,
} from '../../services/grading';
import { Card, Notice, StatusBadge, StepHeading, buttonPrimary, buttonSecondary, inputClass } from '../ui';
import { ScoreCardModal } from '../ScoreCardModal';

type ListFilter = 'all' | 'chua_cham' | 'cho_duyet' | 'da_duyet';

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'chua_cham', label: 'Chưa chấm' },
  { id: 'cho_duyet', label: 'Chờ duyệt' },
  { id: 'da_duyet', label: 'Đã duyệt' },
];

const AUDIT_LABELS: Record<AuditAction, string> = {
  CHẤM_LẦN_ĐẦU: 'AI chấm lần đầu',
  CHẤM_LẠI: 'AI chấm lại',
  SỬA_ĐIỂM: 'Giáo viên sửa điểm',
  DUYỆT_ĐIỂM: 'Giáo viên duyệt điểm',
  HỦY_DUYỆT: 'Mở lại để sửa',
};

const EssayViewer: React.FC<{ submission: Submission }> = ({ submission }) => (
  <div className="space-y-3">
    {submission.content && (
      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 whitespace-pre-wrap text-[15px] leading-7 text-slate-900">
        {submission.content}
      </div>
    )}
    {submission.attachments.map((att, index) => (
      <figure key={att.id} className="space-y-1">
        {isImageFile(att) && (
          <img
            src={attachmentHref(att)}
            alt={`Bài làm của ${submission.studentName}, ảnh ${index + 1}`}
            className="w-full rounded-lg border border-slate-200 bg-slate-50"
          />
        )}
        {isPdfFile(att) && (
          <iframe
            src={attachmentHref(att)}
            title={`Bài làm của ${submission.studentName}: ${att.name}`}
            className="w-full h-[75vh] rounded-lg border border-slate-200"
          />
        )}
        <figcaption>
          <a
            href={attachmentHref(att)}
            download={att.name}
            className="inline-flex items-center gap-1 text-sm text-blue-800 hover:underline break-all"
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            {att.name}
          </a>
        </figcaption>
      </figure>
    ))}
  </div>
);

interface ReviewPanelProps {
  submission: Submission;
  exam: Exam;
  result: GradingResult;
  history: AuditLog[];
  teacherName: string;
  isBusy: boolean;
  nextToReview: Submission | undefined;
  onRegrade: () => void;
  onSaveResult: (result: GradingResult) => void;
  onAudit: (action: AuditAction, oldScore: number, newScore: number, details: string) => void;
  onGoToNext: (id: string) => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  submission,
  exam,
  result,
  history,
  teacherName,
  isBusy,
  nextToReview,
  onRegrade,
  onSaveResult,
  onAudit,
  onGoToNext,
}) => {
  const [grades, setGrades] = useState<CriterionGrade[]>(result.criteriaGrades);
  const [scoreTexts, setScoreTexts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState(result.teacherReviewNotes || '');
  const [showScoreCard, setShowScoreCard] = useState(false);
  const isApproved = result.status === 'Đã duyệt';

  const total = Math.min(sumCriteria(grades), result.totalMaxScore);
  const shownTotal = result.criteriaGrades.length > 0 ? total : effectiveScore(result);
  const wasEdited = shownTotal !== result.aiSuggestedScore;

  const buildResult = (nextGrades: CriterionGrade[], nextNotes: string): GradingResult => ({
    ...result,
    criteriaGrades: nextGrades,
    finalTeacherScore:
      nextGrades.length > 0 ? Math.min(sumCriteria(nextGrades), result.totalMaxScore) : result.finalTeacherScore,
    teacherReviewNotes: nextNotes,
  });

  const commitScore = (grade: CriterionGrade) => {
    const text = scoreTexts[grade.id];
    if (text === undefined) return;

    const parsed = Number(text.replace(',', '.'));
    const value = Number.isFinite(parsed) ? Math.min(grade.maxScore, Math.max(0, Math.round(parsed * 100) / 100)) : criterionScore(grade);
    setScoreTexts(({ [grade.id]: _committed, ...rest }) => rest);
    if (value === criterionScore(grade)) return;

    const nextGrades = grades.map((g) => (g.id === grade.id ? { ...g, teacherScore: value } : g));
    setGrades(nextGrades);
    const next = buildResult(nextGrades, notes);
    onSaveResult(next);
    onAudit(
      'SỬA_ĐIỂM',
      effectiveScore(result),
      effectiveScore(next),
      `${teacherName} sửa "${grade.criterion}": ${formatScore(criterionScore(grade))} thành ${formatScore(value)}.`
    );
  };

  const commitNotes = () => {
    if (notes !== (result.teacherReviewNotes || '')) onSaveResult(buildResult(grades, notes));
  };

  const handleApprove = () => {
    const score = effectiveScore(buildResult(grades, notes));
    onSaveResult({
      ...buildResult(grades, notes),
      finalTeacherScore: score,
      status: 'Đã duyệt',
      approvedAt: new Date().toISOString(),
      approvedBy: teacherName,
    });
    onAudit('DUYỆT_ĐIỂM', score, score, `${teacherName} duyệt ${formatScore(score)}/${result.totalMaxScore} điểm.`);
    if (nextToReview) onGoToNext(nextToReview.id);
  };

  const handleReopen = () => {
    const score = effectiveScore(result);
    onSaveResult({ ...result, status: 'Chờ giáo viên duyệt', approvedAt: undefined, approvedBy: undefined });
    onAudit('HỦY_DUYỆT', score, score, `${teacherName} mở lại bài để sửa điểm.`);
  };

  const handleRegrade = () => {
    if (window.confirm('Chấm lại bài này? Kết quả mới sẽ thay thế điểm và nhận xét hiện tại.')) onRegrade();
  };

  const { generalFeedback: feedback } = result;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-slate-600">{isApproved ? 'Điểm đã duyệt' : 'Điểm AI đề xuất'}</p>
            <p className="mt-0.5">
              <span className="text-4xl font-bold text-slate-900">{formatScore(shownTotal)}</span>
              <span className="text-lg text-slate-500"> / {formatScore(result.totalMaxScore)}</span>
            </p>
            {wasEdited && (
              <p className="text-xs text-slate-600 mt-1">AI đề xuất ban đầu: {formatScore(result.aiSuggestedScore)}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isApproved ? (
              <>
                <button type="button" onClick={handleReopen} className={buttonSecondary}>
                  <Undo2 className="w-4 h-4" />
                  Mở lại để sửa
                </button>
                {nextToReview && (
                  <button type="button" onClick={() => onGoToNext(nextToReview.id)} className={buttonPrimary}>
                    Bài tiếp theo
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </>
            ) : (
              <button type="button" onClick={handleApprove} className={buttonPrimary}>
                <CheckCircle2 className="w-4 h-4" />
                {nextToReview ? 'Duyệt và sang bài tiếp' : 'Duyệt điểm'}
              </button>
            )}
          </div>
        </div>
      </Card>

      {grades.length > 0 && (
        <Card className="overflow-hidden">
          <h3 className="font-bold text-slate-900 p-4 border-b border-slate-200">Điểm từng phần</h3>
          <ul className="divide-y divide-slate-200">
            {grades.map((grade) => (
              <li key={grade.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-500">{grade.section}</p>
                    <p className="font-semibold text-slate-900">{grade.criterion}</p>
                  </div>
                  <label className="flex items-center gap-1.5 flex-shrink-0 text-sm text-slate-600">
                    <span className="sr-only">Điểm phần {grade.criterion}</span>
                    <input
                      type="number"
                      min={0}
                      max={grade.maxScore}
                      step={0.25}
                      disabled={isApproved}
                      value={scoreTexts[grade.id] ?? criterionScore(grade)}
                      onChange={(e) => setScoreTexts((prev) => ({ ...prev, [grade.id]: e.target.value }))}
                      onBlur={() => commitScore(grade)}
                      className={`${inputClass} !w-20 text-right font-semibold`}
                    />
                    / {formatScore(grade.maxScore)}
                  </label>
                </div>
                <p className="text-sm text-slate-700 leading-6">{grade.reason}</p>
                {grade.quoteOrEvidence && (
                  <blockquote className="border-l-2 border-slate-300 pl-3 text-sm italic text-slate-600">
                    {grade.quoteOrEvidence}
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4 space-y-3 text-sm text-slate-800 leading-6">
        <h3 className="font-bold text-slate-900">Nhận xét của AI</h3>
        <p>{feedback.overallComment}</p>
        {feedback.strengths.length > 0 && (
          <div>
            <p className="font-semibold text-emerald-800">Ưu điểm</p>
            <ul className="list-disc pl-5">{feedback.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </div>
        )}
        {feedback.weaknesses.length > 0 && (
          <div>
            <p className="font-semibold text-amber-800">Hạn chế</p>
            <ul className="list-disc pl-5">{feedback.weaknesses.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </div>
        )}
        {feedback.errorsToCorrect.length > 0 && (
          <div>
            <p className="font-semibold text-rose-800">Lỗi cần sửa</p>
            <ul className="space-y-1.5 mt-1">
              {feedback.errorsToCorrect.map((error, i) => (
                <li key={i}>
                  <span className="font-semibold">{error.type}:</span> {error.description}
                  {error.suggestion && <span className="block text-slate-600">Hướng sửa: {error.suggestion}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {feedback.actionableAdvice && (
          <p className="flex gap-2 p-3 bg-slate-50 rounded-lg">
            <Lightbulb className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />
            <span>{feedback.actionableAdvice}</span>
          </p>
        )}
        {result.rubricCoverageCheck && (
          <p className="text-slate-600">
            <span className="font-semibold">Mức đáp ứng hướng dẫn chấm:</span> {result.rubricCoverageCheck}
          </p>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <label htmlFor="teacher-notes" className="block font-bold text-slate-900">
          Nhận xét của giáo viên
        </label>
        <textarea
          id="teacher-notes"
          rows={3}
          disabled={isApproved}
          className={inputClass}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={commitNotes}
          placeholder="In kèm trên phiếu chấm của học sinh"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowScoreCard(true)} className={buttonSecondary}>
            <Printer className="w-4 h-4" />
            In phiếu chấm
          </button>
          <button type="button" onClick={handleRegrade} disabled={isBusy} className={buttonSecondary}>
            <RotateCcw className="w-4 h-4" />
            Chấm lại
          </button>
        </div>
      </Card>

      {history.length > 0 && (
        <details className="bg-white rounded-xl border border-slate-200 p-4 text-sm">
          <summary className="font-semibold text-slate-800 cursor-pointer">Lịch sử chấm ({history.length})</summary>
          <ul className="mt-2 space-y-1.5 text-slate-700">
            {history.map((log) => (
              <li key={log.id}>
                <span className="text-slate-500">{new Date(log.timestamp).toLocaleString('vi-VN')}</span>:{' '}
                <span className="font-semibold">{AUDIT_LABELS[log.action]}</span>. {log.details}
              </li>
            ))}
          </ul>
        </details>
      )}

      {showScoreCard && (
        <ScoreCardModal
          submission={submission}
          exam={exam}
          gradingResult={buildResult(grades, notes)}
          teacherName={teacherName}
          onClose={() => setShowScoreCard(false)}
        />
      )}
    </div>
  );
};

interface GradingStepProps {
  exam: Exam;
  submissions: Submission[];
  results: GradingResult[];
  auditLogs: AuditLog[];
  queue: GradingQueueState;
  teacherName: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onStartGrading: (submissions: Submission[]) => void;
  onStopGrading: () => void;
  onSaveResult: (result: GradingResult) => void;
  onAudit: (
    action: AuditAction,
    oldScore: number | undefined,
    newScore: number,
    details: string,
    submissionId: string,
    resultId: string
  ) => void;
  onGoToSubmissions: () => void;
  onGoToExam: () => void;
  onGoToResults: () => void;
}

export const GradingStep: React.FC<GradingStepProps> = ({
  exam,
  submissions,
  results,
  auditLogs,
  queue,
  teacherName,
  selectedId,
  onSelect,
  onStartGrading,
  onStopGrading,
  onSaveResult,
  onAudit,
  onGoToSubmissions,
  onGoToExam,
  onGoToResults,
}) => {
  const [filter, setFilter] = useState<ListFilter>('all');
  const detailRef = useRef<HTMLDivElement>(null);

  const counts = useMemo(
    () => ({
      all: submissions.length,
      chua_cham: submissions.filter((s) => s.status === 'chua_cham' || s.status === 'dang_cham').length,
      cho_duyet: submissions.filter((s) => s.status === 'cho_duyet').length,
      da_duyet: submissions.filter((s) => s.status === 'da_duyet').length,
    }),
    [submissions]
  );

  const visible = submissions.filter((s) => {
    if (filter === 'all') return true;
    if (filter === 'chua_cham') return s.status === 'chua_cham' || s.status === 'dang_cham';
    return s.status === filter;
  });

  const selected = submissions.find((s) => s.id === selectedId);

  // Opens on the first essay that still needs the teacher, so there is no extra click to start
  useEffect(() => {
    if (selected || submissions.length === 0) return;
    const first =
      submissions.find((s) => s.status === 'cho_duyet') ||
      submissions.find((s) => s.status === 'chua_cham') ||
      submissions[0];
    onSelect(first.id);
  }, [selected, submissions, onSelect]);

  const handleSelect = (id: string) => {
    onSelect(id);
    // On a phone the list and the essay are stacked, so bring the essay into view
    if (window.matchMedia('(max-width: 1023px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (submissions.length === 0) {
    return (
      <div className="space-y-5">
        <StepHeading title="Chấm & duyệt" description="AI chấm từng bài, giáo viên kiểm tra và duyệt điểm." />
        <Card className="p-10 text-center space-y-3">
          <p className="text-slate-700">Đề này chưa có bài làm nào để chấm.</p>
          <button type="button" onClick={onGoToSubmissions} className={buttonPrimary}>
            Tải bài làm lên
            <ArrowRight className="w-4 h-4" />
          </button>
        </Card>
      </div>
    );
  }

  const notGraded = submissions.filter((s) => s.status === 'chua_cham');
  const selectedResult = selected ? getLatestResult(results, selected.id) : undefined;
  const isSelectedGrading = queue.currentId === selected?.id;
  const selectedFailure = selected ? queue.failures[selected.id] : undefined;
  const nextToReview = submissions.find((s) => s.id !== selected?.id && s.status === 'cho_duyet');
  const allApproved = counts.da_duyet === submissions.length;

  return (
    <div className="space-y-5">
      <StepHeading
        title="Chấm & duyệt"
        description="AI chấm từng bài và đề xuất điểm. Giáo viên xem lại, sửa điểm nếu cần rồi duyệt."
        actions={
          allApproved && (
            <button type="button" onClick={onGoToResults} className={buttonPrimary}>
              Xem kết quả
              <ArrowRight className="w-4 h-4" />
            </button>
          )
        }
      />

      {(!hasAnswerKey(exam) || !hasExamPrompt(exam)) && (
        <Notice
          tone="warning"
          action={
            <button type="button" onClick={onGoToExam} className={buttonSecondary}>
              Bổ sung
            </button>
          }
        >
          {!hasExamPrompt(exam) && !hasAnswerKey(exam)
            ? 'Đề này chưa có đề bài và đáp án, nên AI chỉ chấm được theo chuẩn chung.'
            : !hasAnswerKey(exam)
              ? 'Đề này chưa có đáp án, nên AI chỉ chấm được theo chuẩn chung.'
              : 'Đề này chưa có nội dung đề bài, nên AI phải suy ra yêu cầu từ đáp án.'}
        </Notice>
      )}

      {queue.stopReason && !queue.isRunning && <Notice tone="error">Đã dừng chấm: {queue.stopReason}</Notice>}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
        {/* Left: the class list and the grade-all control */}
        <Card className="overflow-hidden lg:sticky lg:top-24">
          <div className="p-3 border-b border-slate-200 space-y-2">
            {queue.isRunning ? (
              <div className="space-y-2">
                <div
                  role="progressbar"
                  aria-label="Tiến độ chấm"
                  aria-valuemin={0}
                  aria-valuemax={queue.total}
                  aria-valuenow={queue.doneCount}
                  className="h-2 bg-slate-200 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-blue-700 transition-all"
                    style={{ width: `${queue.total ? (queue.doneCount / queue.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-sm text-slate-700" aria-live="polite">
                  Đang chấm: {queue.doneCount}/{queue.total} bài xong
                </p>
                <button type="button" onClick={onStopGrading} className={`${buttonSecondary} w-full`}>
                  <Square className="w-4 h-4" />
                  Dừng sau bài này
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={notGraded.length === 0}
                onClick={() => onStartGrading(notGraded)}
                className={`${buttonPrimary} w-full`}
              >
                <BrainCircuit className="w-4 h-4" />
                {notGraded.length > 0 ? `Chấm ${notGraded.length} bài chưa chấm` : 'Đã chấm hết'}
              </button>
            )}
            <div role="group" aria-label="Lọc danh sách bài" className="flex flex-wrap gap-1">
              {FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                  className={`px-2 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    filter === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label} ({counts[id]})
                </button>
              ))}
            </div>
          </div>

          <ul className="max-h-[32rem] overflow-y-auto divide-y divide-slate-100">
            {visible.map((submission) => {
              const result = getLatestResult(results, submission.id);
              return (
                <li key={submission.id}>
                  <button
                    type="button"
                    aria-current={submission.id === selectedId ? 'true' : undefined}
                    onClick={() => handleSelect(submission.id)}
                    className={`w-full text-left px-3 py-2.5 cursor-pointer transition-colors ${
                      submission.id === selectedId ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">{submission.studentName}</span>
                      {result && <span className="font-semibold text-sm text-slate-900">{formatScore(effectiveScore(result))}</span>}
                    </span>
                    <span className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs text-slate-500">{submission.studentClass}</span>
                      <StatusBadge
                        status={submission.status}
                        isGrading={queue.currentId === submission.id}
                        isWaiting={queue.queuedIds.includes(submission.id)}
                        hasFailed={Boolean(queue.failures[submission.id])}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && <li className="p-4 text-sm text-slate-600 text-center">Không có bài nào.</li>}
          </ul>
        </Card>

        {/* Right: the selected essay beside its grades */}
        <div ref={detailRef} className="min-w-0 scroll-mt-24">
          {selected && (
            <div key={selected.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="text-lg font-bold text-slate-900">{selected.studentName}</h3>
                <span className="text-sm text-slate-600">
                  {[selected.studentClass && `Lớp ${selected.studentClass}`, selected.studentCode].filter(Boolean).join(' · ')}
                </span>
                <StatusBadge status={selected.status} isGrading={isSelectedGrading} />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <Card className="p-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
                  <h4 className="font-bold text-slate-900 mb-3">Bài làm</h4>
                  <EssayViewer submission={selected} />
                </Card>

                <div className="min-w-0 space-y-3">
                  {selectedFailure && !isSelectedGrading && <Notice tone="error">{selectedFailure}</Notice>}

                  {isSelectedGrading ? (
                    <Card className="p-10 text-center space-y-2" >
                      <Loader2 className="w-8 h-8 text-blue-700 mx-auto animate-spin" />
                      <p className="font-semibold text-slate-900" role="status">
                        AI đang đọc và chấm bài này
                      </p>
                      <p className="text-sm text-slate-600">Thường mất dưới một phút. Có thể xem bài khác trong lúc chờ.</p>
                    </Card>
                  ) : selectedResult ? (
                    <ReviewPanel
                      key={selectedResult.id}
                      submission={selected}
                      exam={exam}
                      result={selectedResult}
                      history={auditLogs.filter((log) => log.submissionId === selected.id)}
                      teacherName={teacherName}
                      isBusy={queue.isRunning}
                      nextToReview={nextToReview}
                      onRegrade={() => onStartGrading([selected])}
                      onSaveResult={onSaveResult}
                      onAudit={(action, oldScore, newScore, details) =>
                        onAudit(action, oldScore, newScore, details, selected.id, selectedResult.id)
                      }
                      onGoToNext={onSelect}
                    />
                  ) : (
                    <Card className="p-10 text-center space-y-3">
                      <p className="text-slate-700">
                        {selectedFailure ? 'Bài này chưa chấm được.' : 'Bài này chưa được chấm.'}
                      </p>
                      <button
                        type="button"
                        disabled={queue.isRunning}
                        onClick={() => onStartGrading([selected])}
                        className={buttonPrimary}
                      >
                        <BrainCircuit className="w-4 h-4" />
                        {selectedFailure ? 'Chấm lại bài này' : 'Chấm bài này'}
                      </button>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
