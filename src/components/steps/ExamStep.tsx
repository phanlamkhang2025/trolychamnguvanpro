import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, FileText, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Attachment, Exam, GradeLevel } from '../../types';
import { attachmentHref } from '../../services/storage';
import {
  ACCEPTED_FILE_TYPES,
  checkFile,
  formatFileSize,
  isWordFile,
  readFileAsAttachment,
  readWordFile,
} from '../../services/files';
import {
  Card,
  Notice,
  StepHeading,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  iconButton,
  inputClass,
  labelClass,
} from '../ui';

const FileField: React.FC<{
  id: string;
  label: string;
  files: Attachment[];
  onChange: (files: Attachment[]) => void;
}> = ({ id, label, files, onChange }) => {
  const [isReading, setIsReading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []) as File[];
    e.target.value = '';
    if (selected.length === 0) return;

    setIsReading(true);
    setError('');
    const added: Attachment[] = [];
    for (const file of selected) {
      const problem = checkFile(file);
      if (problem) {
        setError(problem);
        continue;
      }
      try {
        // Finds an unreadable Word file now, not in the middle of grading a class
        if (isWordFile(file)) await readWordFile(file);
        added.push(await readFileAsAttachment(file));
      } catch {
        setError(`Không đọc được tệp "${file.name}". Vui lòng lưu lại rồi tải lên.`);
      }
    }
    if (added.length > 0) onChange([...files, ...added]);
    setIsReading(false);
  };

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-2 pl-3 pr-1 py-1 bg-slate-50 border border-slate-200 rounded-lg">
              <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="flex-1 min-w-0 truncate text-sm text-slate-800" title={file.name}>
                {file.name}
              </span>
              <span className="text-xs text-slate-500 flex-shrink-0">{formatFileSize(file.size)}</span>
              <a href={attachmentHref(file)} download={file.name} aria-label={`Tải về ${file.name}`} className={iconButton}>
                <Download className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => onChange(files.filter((f) => f.id !== file.id))}
                aria-label={`Xóa ${file.name}`}
                className={iconButton}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      <input id={id} type="file" multiple accept={ACCEPTED_FILE_TYPES} onChange={handleUpload} className="sr-only" />
      <label htmlFor={id} className={buttonSecondary}>
        {isReading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
        {label}
      </label>
    </div>
  );
};

const newExamDraft = (school: string): Exam => ({
  id: 'exam-' + Date.now(),
  title: '',
  gradeLevel: '11',
  school,
  classes: [],
  prompt: '',
  promptFiles: [],
  guideOrSolution: '',
  referenceFiles: [],
  maxScore: 10,
  criteria: [],
  teacherNotes: '',
  createdAt: '',
  updatedAt: '',
});

interface ExamStepProps {
  exam: Exam | null;
  defaultSchool: string;
  submissionCount: number;
  canCancel: boolean;
  onSave: (exam: Exam, goToNextStep: boolean) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

export const ExamStep: React.FC<ExamStepProps> = ({
  exam,
  defaultSchool,
  submissionCount,
  canCancel,
  onSave,
  onDelete,
  onCancel,
}) => {
  const [draft, setDraft] = useState<Exam>(() => exam ?? newExamDraft(defaultSchool));
  const [classesText, setClassesText] = useState(() => (exam?.classes || []).join(', '));
  const [error, setError] = useState('');
  const isNew = !exam;

  // Moving to another step keeps what was typed, so nothing depends on remembering to press save
  const unsavedRef = useRef<Exam | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  useEffect(
    () => () => {
      if (unsavedRef.current?.title.trim()) onSaveRef.current(unsavedRef.current, false);
    },
    []
  );

  const update = (changes: Partial<Exam>) => {
    const next = { ...draft, ...changes };
    setDraft(next);
    unsavedRef.current = next;
    setError('');
  };

  const handleClassesChange = (value: string) => {
    setClassesText(value);
    update({ classes: value.split(',').map((c) => c.trim()).filter(Boolean) });
  };

  const handleSave = () => {
    if (!draft.title.trim()) {
      setError('Vui lòng đặt tên cho đề kiểm tra.');
      return;
    }
    unsavedRef.current = null;
    onSave({ ...draft, title: draft.title.trim(), maxScore: Number(draft.maxScore) || 10 }, true);
  };

  const handleDelete = () => {
    if (!exam) return;
    const detail = submissionCount > 0 ? ` cùng ${submissionCount} bài làm và điểm của các bài này` : '';
    if (window.confirm(`Xóa đề "${exam.title}"${detail}? Không thể hoàn tác.`)) {
      unsavedRef.current = null;
      onDelete(exam.id);
    }
  };

  const hasKey = draft.guideOrSolution.trim() || (draft.referenceFiles?.length ?? 0) > 0;

  return (
    <div className="space-y-5 max-w-4xl">
      <StepHeading
        title={isNew ? 'Tạo đề mới' : 'Đề & đáp án'}
        description="Nhập hoặc tải lên đề bài và đáp án. Mỗi đề dùng chung cho mọi bài làm tải lên ở bước sau."
      />

      <Card className="p-5 grid grid-cols-1 sm:grid-cols-6 gap-4">
        <div className="sm:col-span-6">
          <label htmlFor="exam-title" className={labelClass}>
            Tên đề <span className="text-rose-600">*</span>
          </label>
          <input
            id="exam-title"
            className={inputClass}
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Ví dụ: Kiểm tra giữa kì I - Ngữ văn 11"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="exam-grade" className={labelClass}>
            Khối
          </label>
          <select
            id="exam-grade"
            className={inputClass}
            value={draft.gradeLevel}
            onChange={(e) => update({ gradeLevel: e.target.value as GradeLevel })}
          >
            <option value="10">Lớp 10</option>
            <option value="11">Lớp 11</option>
            <option value="12">Lớp 12</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="exam-classes" className={labelClass}>
            Lớp
          </label>
          <input
            id="exam-classes"
            className={inputClass}
            value={classesText}
            onChange={(e) => handleClassesChange(e.target.value)}
            placeholder="11A1, 11A2"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="exam-max" className={labelClass}>
            Thang điểm
          </label>
          <input
            id="exam-max"
            type="number"
            min={1}
            step={0.5}
            className={inputClass}
            value={draft.maxScore}
            onChange={(e) => update({ maxScore: Number(e.target.value) })}
          />
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-bold text-slate-900">Đề bài</h3>
          <p className="text-sm text-slate-600 mt-0.5">Dán nội dung đề, hoặc tải lên tệp Word, PDF, ảnh chụp đề.</p>
        </div>
        <textarea
          aria-label="Nội dung đề bài"
          rows={6}
          className={inputClass}
          value={draft.prompt}
          onChange={(e) => update({ prompt: e.target.value })}
          placeholder="Phần I. Đọc hiểu... Phần II. Viết..."
        />
        <FileField
          id="exam-prompt-files"
          label="Tải đề bài lên"
          files={draft.promptFiles || []}
          onChange={(promptFiles) => update({ promptFiles })}
        />
      </Card>

      <Card className="p-5 space-y-3">
        <div>
          <h3 className="font-bold text-slate-900">Đáp án, lời giải, phổ điểm</h3>
          <p className="text-sm text-slate-600 mt-0.5">
            AI đối chiếu từng bài với phần này. Có thể dán vào ô dưới, tải tệp lên, hoặc cả hai.
          </p>
        </div>
        <textarea
          aria-label="Nội dung đáp án, lời giải, phổ điểm"
          rows={8}
          className={inputClass}
          value={draft.guideOrSolution}
          onChange={(e) => update({ guideOrSolution: e.target.value })}
          placeholder="Câu 1 (0,5 điểm): ... &#10;Câu 2 (1,0 điểm): ..."
        />
        <FileField
          id="exam-reference-files"
          label="Tải đáp án / phổ điểm lên"
          files={draft.referenceFiles || []}
          onChange={(referenceFiles) => update({ referenceFiles })}
        />
        {!hasKey && (
          <Notice tone="warning">
            Chưa có đáp án: AI vẫn chấm được theo chuẩn chung GDPT 2018, nhưng kết quả sẽ kém sát với yêu cầu của đề.
          </Notice>
        )}
      </Card>

      <Card className="p-5">
        <label htmlFor="exam-notes" className={labelClass}>
          Yêu cầu riêng khi chấm (không bắt buộc)
        </label>
        <textarea
          id="exam-notes"
          rows={2}
          className={inputClass}
          value={draft.teacherNotes || ''}
          onChange={(e) => update({ teacherNotes: e.target.value })}
          placeholder="Ví dụ: trừ tối đa 0,5 điểm lỗi chính tả toàn bài."
        />
      </Card>

      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleSave} className={buttonPrimary}>
          Lưu đề và sang bước Bài làm
          <ArrowRight className="w-4 h-4" />
        </button>
        {isNew && canCancel && (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Hủy
          </button>
        )}
        {!isNew && (
          <button type="button" onClick={handleDelete} className={`${buttonDanger} ml-auto`}>
            <Trash2 className="w-4 h-4" />
            Xóa đề này
          </button>
        )}
      </div>
    </div>
  );
};
