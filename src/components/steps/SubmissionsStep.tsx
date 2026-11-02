import React, { useMemo, useState } from 'react';
import { ArrowRight, ClipboardPaste, FileText, Image as ImageIcon, Loader2, Merge, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { Attachment, Exam, GradingResult, Submission } from '../../types';
import {
  ACCEPTED_FILE_TYPES,
  checkFile,
  isImageFile,
  isWordFile,
  readFileAsAttachment,
  readWordFile,
  studentNameFromFileName,
} from '../../services/files';
import { effectiveScore, formatScore, getLatestResult } from '../../services/grading';
import {
  Card,
  Notice,
  StatusBadge,
  StepHeading,
  buttonPrimary,
  buttonSecondary,
  iconButton,
  inputClass,
} from '../ui';

const MAX_ESSAY_BYTES = 25 * 1024 * 1024;

// One student's essay waiting to be saved
interface PendingEssay {
  key: string;
  studentName: string;
  studentClass: string;
  studentCode: string;
  content: string;
  attachments: Attachment[];
  isSelected: boolean;
  isTyped?: boolean;
}

const naturalOrder = (a: File, b: File) => a.name.localeCompare(b.name, 'vi', { numeric: true });

interface SubmissionsStepProps {
  exam: Exam;
  submissions: Submission[];
  results: GradingResult[];
  gradingId: string | null;
  onSaveSubmission: (submission: Submission) => Promise<boolean>;
  onDeleteSubmission: (id: string) => void;
  onOpenSubmission: (id: string) => void;
  onNext: () => void;
}

export const SubmissionsStep: React.FC<SubmissionsStepProps> = ({
  exam,
  submissions,
  results,
  gradingId,
  onSaveSubmission,
  onDeleteSubmission,
  onOpenSubmission,
  onNext,
}) => {
  const [pending, setPending] = useState<PendingEssay[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [search, setSearch] = useState('');

  const defaultClass = exam.classes?.[0] || '';

  const newEssay = (studentName: string, extra: Partial<PendingEssay> = {}): PendingEssay => ({
    key: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    studentName,
    studentClass: defaultClass,
    studentCode: '',
    content: '',
    attachments: [],
    isSelected: false,
    ...extra,
  });

  const addFiles = async (selected: File[]) => {
    if (selected.length === 0) return;
    setIsReading(true);
    setSaveError('');

    const errors: string[] = [];
    const essays: PendingEssay[] = [];
    // Photos named like "An_1.jpg", "An_2.jpg" are pages of one essay
    const imageGroups = new Map<string, PendingEssay>();

    for (const file of [...selected].sort(naturalOrder)) {
      const problem = checkFile(file);
      if (problem) {
        errors.push(problem);
        continue;
      }
      try {
        const attachment = await readFileAsAttachment(file);
        if (isImageFile(file)) {
          const name = studentNameFromFileName(file.name, true);
          const group = imageGroups.get(name);
          if (group) {
            group.attachments.push(attachment);
          } else {
            const essay = newEssay(name, { attachments: [attachment] });
            imageGroups.set(name, essay);
            essays.push(essay);
          }
        } else {
          const content = isWordFile(file) ? await readWordFile(file) : '';
          essays.push(newEssay(studentNameFromFileName(file.name, false), { content, attachments: [attachment] }));
        }
      } catch {
        errors.push(`Không đọc được tệp "${file.name}". Vui lòng lưu lại rồi tải lên.`);
      }
    }

    setPending((prev) => [...prev, ...essays]);
    setFileErrors(errors);
    setIsReading(false);
  };

  const updatePending = (key: string, changes: Partial<PendingEssay>) => {
    setPending((prev) => prev.map((essay) => (essay.key === key ? { ...essay, ...changes } : essay)));
  };

  const selectedCount = pending.filter((essay) => essay.isSelected).length;

  const mergeSelected = () => {
    setPending((prev) => {
      const selected = prev.filter((essay) => essay.isSelected);
      if (selected.length < 2) return prev;
      const merged: PendingEssay = {
        ...selected[0],
        isSelected: false,
        content: selected.map((essay) => essay.content).filter(Boolean).join('\n\n'),
        attachments: selected.flatMap((essay) => essay.attachments),
      };
      return prev.flatMap((essay) => {
        if (essay.key === selected[0].key) return [merged];
        return essay.isSelected ? [] : [essay];
      });
    });
  };

  const handleSaveAll = async () => {
    const unnamed = pending.some((essay) => !essay.studentName.trim());
    if (unnamed) {
      setSaveError('Vui lòng nhập họ tên cho mọi bài trước khi lưu.');
      return;
    }
    const empty = pending.find((essay) => !essay.content.trim() && essay.attachments.length === 0);
    if (empty) {
      setSaveError(`Bài của ${empty.studentName} chưa có nội dung.`);
      return;
    }
    const tooLarge = pending.find(
      (essay) => essay.attachments.reduce((sum, att) => sum + att.size, 0) > MAX_ESSAY_BYTES
    );
    if (tooLarge) {
      setSaveError(`Bài của ${tooLarge.studentName} vượt quá 25 MB. Vui lòng bớt tệp hoặc chụp ảnh nhẹ hơn.`);
      return;
    }

    setIsSaving(true);
    setSaveError('');
    const notSaved: PendingEssay[] = [];
    let index = 0;
    for (const essay of pending) {
      index += 1;
      const saved = await onSaveSubmission({
        id: `sub-${Date.now()}-${index}`,
        examId: exam.id,
        studentName: essay.studentName.trim(),
        studentClass: essay.studentClass.trim(),
        studentCode: essay.studentCode.trim(),
        school: exam.school,
        submittedAt: new Date().toISOString(),
        content: essay.content.trim(),
        attachments: essay.attachments,
        status: 'chua_cham',
      });
      if (!saved) notSaved.push(essay);
    }
    setPending(notSaved);
    if (notSaved.length > 0) setSaveError(`Trình duyệt chưa lưu được ${notSaved.length} bài, các bài này vẫn ở danh sách trên.`);
    setIsSaving(false);
  };

  const handleDelete = (submission: Submission) => {
    if (window.confirm(`Xóa bài của ${submission.studentName} cùng điểm đã chấm? Không thể hoàn tác.`)) {
      onDeleteSubmission(submission.id);
    }
  };

  const visibleSubmissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? submissions.filter(
          (s) =>
            s.studentName.toLowerCase().includes(query) ||
            s.studentClass.toLowerCase().includes(query) ||
            (s.studentCode || '').toLowerCase().includes(query)
        )
      : submissions;
  }, [submissions, search]);

  const notGradedCount = submissions.filter((s) => s.status === 'chua_cham').length;

  return (
    <div className="space-y-5">
      <StepHeading
        title="Bài làm"
        description="Tải lên tệp Word, PDF hoặc ảnh chụp bài làm. Mỗi tệp là một bài; ảnh đặt tên kiểu An_1, An_2 được ghép thành một bài."
        actions={
          submissions.length > 0 && (
            <button type="button" onClick={onNext} className={buttonPrimary}>
              Sang bước Chấm & duyệt
              {notGradedCount > 0 && ` (${notGradedCount} bài chưa chấm)`}
              <ArrowRight className="w-4 h-4" />
            </button>
          )
        }
      />

      <label
        htmlFor="essay-files"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          void addFiles(Array.from(e.dataTransfer.files) as File[]);
        }}
        className={`block rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-blue-600 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-500'
        }`}
      >
        {isReading ? (
          <Loader2 className="w-8 h-8 text-blue-700 mx-auto animate-spin" />
        ) : (
          <UploadCloud className="w-8 h-8 text-blue-700 mx-auto" />
        )}
        <span className="block font-semibold text-slate-900 mt-2">Kéo thả bài làm vào đây, hoặc bấm để chọn tệp</span>
        <span className="block text-sm text-slate-600 mt-1">
          Chọn được nhiều tệp một lúc. Word (.docx), PDF, ảnh; tối đa 15 MB mỗi tệp.
        </span>
        <input
          id="essay-files"
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files || []) as File[];
            e.target.value = '';
            void addFiles(files);
          }}
        />
      </label>

      <div>
        <button
          type="button"
          onClick={() => setPending((prev) => [...prev, newEssay('', { isTyped: true })])}
          className={buttonSecondary}
        >
          <ClipboardPaste className="w-4 h-4" />
          Dán văn bản bài làm
        </button>
      </div>

      {fileErrors.map((message) => (
        <Notice key={message} tone="error">
          {message}
        </Notice>
      ))}

      {pending.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-200">
            <div>
              <h3 className="font-bold text-slate-900">Kiểm tra trước khi lưu ({pending.length} bài)</h3>
              <p className="text-sm text-slate-600">Sửa lại tên học sinh nếu cần. Bài chụp nhiều ảnh: chọn các ảnh rồi bấm Gộp.</p>
            </div>
            {selectedCount >= 2 && (
              <button type="button" onClick={mergeSelected} className={buttonSecondary}>
                <Merge className="w-4 h-4" />
                Gộp {selectedCount} mục thành một bài
              </button>
            )}
          </div>

          <ul className="divide-y divide-slate-200">
            {pending.map((essay) => (
              <li key={essay.key} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`Chọn bài của ${essay.studentName || 'học sinh chưa có tên'} để gộp`}
                    checked={essay.isSelected}
                    onChange={(e) => updatePending(essay.key, { isSelected: e.target.checked })}
                    className="w-4 h-4 accent-blue-700"
                  />
                  <input
                    aria-label="Họ tên học sinh"
                    className={`${inputClass} flex-1 min-w-48`}
                    value={essay.studentName}
                    placeholder="Họ tên học sinh"
                    onChange={(e) => updatePending(essay.key, { studentName: e.target.value })}
                  />
                  <input
                    aria-label="Lớp"
                    className={`${inputClass} !w-24`}
                    value={essay.studentClass}
                    placeholder="Lớp"
                    onChange={(e) => updatePending(essay.key, { studentClass: e.target.value })}
                  />
                  <input
                    aria-label="Mã học sinh, không bắt buộc"
                    className={`${inputClass} !w-32`}
                    value={essay.studentCode}
                    placeholder="Mã HS (nếu có)"
                    onChange={(e) => updatePending(essay.key, { studentCode: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setPending((prev) => prev.filter((p) => p.key !== essay.key))}
                    aria-label={`Bỏ bài của ${essay.studentName || 'học sinh chưa có tên'}`}
                    className={iconButton}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {essay.isTyped ? (
                  <textarea
                    aria-label="Nội dung bài làm"
                    rows={5}
                    className={inputClass}
                    value={essay.content}
                    placeholder="Dán nội dung bài làm vào đây"
                    onChange={(e) => updatePending(essay.key, { content: e.target.value })}
                  />
                ) : (
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 pl-6">
                    {essay.attachments.map((att) => (
                      <span key={att.id} className="inline-flex items-center gap-1 min-w-0">
                        {isImageFile(att) ? <ImageIcon className="w-4 h-4 flex-shrink-0" /> : <FileText className="w-4 h-4 flex-shrink-0" />}
                        <span className="truncate max-w-56" title={att.name}>
                          {att.name}
                        </span>
                      </span>
                    ))}
                    {essay.content && <span className="text-emerald-800">Đã đọc {essay.content.split(/\s+/).length} chữ</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>

          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
            {saveError && <Notice tone="error">{saveError}</Notice>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleSaveAll} disabled={isSaving} className={buttonPrimary}>
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Lưu {pending.length} bài
              </button>
              <button type="button" onClick={() => setPending([])} disabled={isSaving} className={buttonSecondary}>
                Bỏ tất cả
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-900">Bài đã lưu ({submissions.length})</h3>
          {submissions.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                aria-label="Tìm học sinh"
                className={`${inputClass} pl-9`}
                value={search}
                placeholder="Tìm theo tên, lớp, mã"
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>

        {submissions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">Đề này chưa có bài làm nào.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Học sinh</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Lớp</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Tệp</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Trạng thái</th>
                  <th scope="col" className="px-4 py-2 font-semibold text-right">Điểm</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleSubmissions.map((submission) => {
                  const result = getLatestResult(results, submission.id);
                  return (
                    <tr key={submission.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => onOpenSubmission(submission.id)}
                          className="font-semibold text-blue-800 hover:underline cursor-pointer text-left"
                        >
                          {submission.studentName}
                        </button>
                        {submission.studentCode && <span className="block text-xs text-slate-500">{submission.studentCode}</span>}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{submission.studentClass || '—'}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {submission.attachments.length > 0 ? `${submission.attachments.length} tệp` : 'Văn bản'}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={submission.status} isGrading={gradingId === submission.id} />
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-900">
                        {result ? formatScore(effectiveScore(result)) : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(submission)}
                          aria-label={`Xóa bài của ${submission.studentName}`}
                          className={iconButton}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {visibleSubmissions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-600">
                      Không tìm thấy học sinh phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
