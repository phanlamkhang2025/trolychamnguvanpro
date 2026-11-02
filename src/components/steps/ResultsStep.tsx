import React, { useMemo, useState } from 'react';
import { Download, Printer, Search } from 'lucide-react';
import { Exam, GradingResult, Submission } from '../../types';
import { ScoreBand, effectiveScore, formatScore, getLatestResult, scoreBand } from '../../services/grading';
import { Card, StatusBadge, StepHeading, buttonPrimary, iconButton, inputClass } from '../ui';
import { ScoreCardModal } from '../ScoreCardModal';

type SortOrder = 'score_desc' | 'score_asc' | 'name' | 'class';

const lastName = (fullName: string) => fullName.trim().split(/\s+/).pop() || '';

function csvCell(value: string): string {
  // Keep student text from being run as a spreadsheet formula
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
}

const STATUS_LABELS: Record<string, string> = {
  chua_cham: 'Chưa chấm',
  dang_cham: 'Đang chấm',
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
};

const BANDS: ScoreBand[] = ['Giỏi', 'Khá', 'Trung bình', 'Yếu'];

interface ResultsStepProps {
  exam: Exam;
  submissions: Submission[];
  results: GradingResult[];
  teacherName: string;
  onOpenSubmission: (id: string) => void;
}

export const ResultsStep: React.FC<ResultsStepProps> = ({ exam, submissions, results, teacherName, onOpenSubmission }) => {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('score_desc');
  const [scoreCardId, setScoreCardId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      submissions.map((submission) => {
        const result = getLatestResult(results, submission.id);
        const score = result ? effectiveScore(result) : undefined;
        return {
          submission,
          result,
          score,
          band: score !== undefined ? scoreBand(score, result!.totalMaxScore) : undefined,
        };
      }),
    [submissions, results]
  );

  const scored = rows.filter((row) => row.score !== undefined);
  const scores = scored.map((row) => row.score as number);
  const approvedCount = submissions.filter((s) => s.status === 'da_duyet').length;
  const waitingCount = submissions.filter((s) => s.status === 'cho_duyet').length;
  const notGradedCount = submissions.length - approvedCount - waitingCount;
  const average = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined;

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? rows.filter(({ submission: s }) =>
          [s.studentName, s.studentClass, s.studentCode || ''].some((value) => value.toLowerCase().includes(query))
        )
      : rows;
    return [...filtered].sort((a, b) => {
      if (sortOrder === 'score_desc') return (b.score ?? -1) - (a.score ?? -1);
      if (sortOrder === 'score_asc') return (a.score ?? Infinity) - (b.score ?? Infinity);
      if (sortOrder === 'class') return a.submission.studentClass.localeCompare(b.submission.studentClass, 'vi', { numeric: true });
      return lastName(a.submission.studentName).localeCompare(lastName(b.submission.studentName), 'vi');
    });
  }, [rows, search, sortOrder]);

  const handleExport = () => {
    const headers = ['STT', 'Mã học sinh', 'Họ và tên', 'Lớp', 'Trạng thái', 'Điểm', 'Thang điểm', 'Xếp loại', 'Nhận xét'];
    const lines = visibleRows.map(({ submission: s, result, score, band }, index) =>
      [
        index + 1,
        csvCell(s.studentCode || ''),
        csvCell(s.studentName),
        csvCell(s.studentClass),
        csvCell(STATUS_LABELS[s.status] || ''),
        score ?? '',
        result?.totalMaxScore ?? exam.maxScore,
        csvCell(band || ''),
        csvCell(result?.teacherReviewNotes || result?.generalFeedback?.overallComment || ''),
      ].join(',')
    );
    // UTF-8 BOM for Excel Vietnamese display
    const blob = new Blob(['﻿' + [headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bang_diem_${exam.title.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const scoreCardRow = rows.find((row) => row.submission.id === scoreCardId);

  const tiles = [
    { label: 'Tổng số bài', value: String(submissions.length) },
    { label: 'Đã duyệt', value: String(approvedCount) },
    { label: 'Chờ duyệt', value: String(waitingCount) },
    { label: 'Chưa chấm', value: String(notGradedCount) },
    { label: 'Điểm trung bình', value: average !== undefined ? formatScore(Math.round(average * 100) / 100) : '—' },
    {
      label: 'Cao nhất / Thấp nhất',
      value: scores.length > 0 ? `${formatScore(Math.max(...scores))} / ${formatScore(Math.min(...scores))}` : '—',
    },
  ];

  return (
    <div className="space-y-5">
      <StepHeading
        title="Kết quả"
        description={`Bảng điểm đề "${exam.title}". Điểm trung bình tính trên các bài đã có điểm, gồm cả bài chờ duyệt.`}
        actions={
          <button type="button" onClick={handleExport} disabled={submissions.length === 0} className={buttonPrimary}>
            <Download className="w-4 h-4" />
            Xuất bảng điểm (Excel)
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-xs font-semibold text-slate-600">{tile.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{tile.value}</p>
          </Card>
        ))}
      </div>

      {scored.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold text-slate-800 mb-2">Xếp loại</p>
          <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
            {BANDS.map((band) => (
              <div key={band} className="flex items-baseline gap-2">
                <dt className="text-slate-600">{band}</dt>
                <dd className="font-bold text-slate-900">{scored.filter((row) => row.band === band).length}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-200">
          <div className="relative flex-1 min-w-48">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              aria-label="Tìm học sinh"
              className={`${inputClass} pl-9`}
              value={search}
              placeholder="Tìm theo tên, lớp, mã"
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Sắp xếp bảng điểm"
            className={`${inputClass} !w-auto`}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          >
            <option value="score_desc">Điểm cao đến thấp</option>
            <option value="score_asc">Điểm thấp đến cao</option>
            <option value="name">Theo tên (A-Z)</option>
            <option value="class">Theo lớp</option>
          </select>
        </div>

        {submissions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600">Chưa có bài làm nào.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Học sinh</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Lớp</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Trạng thái</th>
                  <th scope="col" className="px-4 py-2 font-semibold text-right">Điểm</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Xếp loại</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Phiếu chấm</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleRows.map(({ submission, result, score, band }) => (
                  <tr key={submission.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenSubmission(submission.id)}
                        className="font-semibold text-blue-800 hover:underline cursor-pointer text-left"
                      >
                        {submission.studentName}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{submission.studentClass || '—'}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={submission.status} />
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">
                      {score !== undefined ? formatScore(score) : '—'}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{band || '—'}</td>
                    <td className="px-4 py-2 text-right">
                      {result && (
                        <button
                          type="button"
                          onClick={() => setScoreCardId(submission.id)}
                          aria-label={`In phiếu chấm của ${submission.studentName}`}
                          className={iconButton}
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {scoreCardRow?.result && (
        <ScoreCardModal
          submission={scoreCardRow.submission}
          exam={exam}
          gradingResult={scoreCardRow.result}
          teacherName={teacherName}
          onClose={() => setScoreCardId(null)}
        />
      )}
    </div>
  );
};
