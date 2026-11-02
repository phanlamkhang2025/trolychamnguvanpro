import React from 'react';
import { Printer, X } from 'lucide-react';
import { Exam, GradingResult, Submission } from '../types';
import { criterionScore, effectiveScore, formatScore } from '../services/grading';
import { buttonPrimary, iconButton } from './ui';

interface ScoreCardModalProps {
  onClose: () => void;
  submission: Submission;
  exam: Exam;
  gradingResult: GradingResult;
  teacherName: string;
}

export const ScoreCardModal: React.FC<ScoreCardModalProps> = ({ onClose, submission, exam, gradingResult, teacherName }) => {
  const { generalFeedback: feedback } = gradingResult;
  const isApproved = gradingResult.status === 'Đã duyệt';
  const signer = gradingResult.approvedBy || teacherName;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 print:p-0 print:bg-white">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-card-title"
        className="bg-white rounded-xl max-w-3xl mx-auto border border-slate-200 shadow-xl print:border-0 print:shadow-none"
      >
        <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 print:hidden">
          <button type="button" onClick={() => window.print()} className={buttonPrimary}>
            <Printer className="w-4 h-4" />
            In / Lưu PDF
          </button>
          <button type="button" onClick={onClose} aria-label="Đóng" className={iconButton}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="print-area p-8 space-y-5 text-sm text-slate-900 leading-6">
          <div className="text-center">
            {exam.school && <p className="uppercase text-xs tracking-wide text-slate-600">{exam.school}</p>}
            <h2 id="score-card-title" className="text-lg font-bold mt-1">
              PHIẾU CHẤM BÀI MÔN NGỮ VĂN
            </h2>
            <p className="text-slate-700">{exam.title}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-y border-slate-300 py-3">
            <p>
              <strong>Học sinh:</strong> {submission.studentName}
            </p>
            <p>
              <strong>Lớp:</strong> {submission.studentClass || '—'}
            </p>
            {submission.studentCode && (
              <p>
                <strong>Mã học sinh:</strong> {submission.studentCode}
              </p>
            )}
            <p>
              <strong>Tình trạng:</strong> {isApproved ? 'Giáo viên đã duyệt' : 'Chờ giáo viên duyệt'}
            </p>
          </div>

          <p className="text-center">
            <span className="font-semibold">Tổng điểm: </span>
            <span className="text-2xl font-bold">{formatScore(effectiveScore(gradingResult))}</span>
            <span> / {formatScore(gradingResult.totalMaxScore)}</span>
          </p>

          {gradingResult.criteriaGrades.length > 0 && (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 print:bg-white text-left">
                  <th scope="col" className="border border-slate-300 p-2">Phần / tiêu chí</th>
                  <th scope="col" className="border border-slate-300 p-2 text-center w-16">Điểm</th>
                  <th scope="col" className="border border-slate-300 p-2 text-center w-16">Tối đa</th>
                  <th scope="col" className="border border-slate-300 p-2">Nhận xét</th>
                </tr>
              </thead>
              <tbody>
                {gradingResult.criteriaGrades.map((grade) => (
                  <tr key={grade.id} className="align-top">
                    <td className="border border-slate-300 p-2">
                      <span className="block text-slate-600">{grade.section}</span>
                      {grade.criterion}
                    </td>
                    <td className="border border-slate-300 p-2 text-center font-bold">{formatScore(criterionScore(grade))}</td>
                    <td className="border border-slate-300 p-2 text-center">{formatScore(grade.maxScore)}</td>
                    <td className="border border-slate-300 p-2">
                      {grade.reason}
                      {grade.quoteOrEvidence && <span className="block italic text-slate-600 mt-1">"{grade.quoteOrEvidence}"</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="space-y-2">
            <h3 className="font-bold">Nhận xét</h3>
            <p>{feedback.overallComment}</p>
            {feedback.strengths.length > 0 && (
              <div>
                <p className="font-semibold">Ưu điểm</p>
                <ul className="list-disc pl-5">{feedback.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </div>
            )}
            {feedback.weaknesses.length > 0 && (
              <div>
                <p className="font-semibold">Hạn chế</p>
                <ul className="list-disc pl-5">{feedback.weaknesses.map((item, i) => <li key={i}>{item}</li>)}</ul>
              </div>
            )}
            {feedback.errorsToCorrect.length > 0 && (
              <div>
                <p className="font-semibold">Lỗi cần sửa</p>
                <ul className="list-disc pl-5">
                  {feedback.errorsToCorrect.map((error, i) => (
                    <li key={i}>
                      {error.type}: {error.description}
                      {error.suggestion && ` Hướng sửa: ${error.suggestion}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {feedback.actionableAdvice && (
              <p>
                <span className="font-semibold">Lời khuyên: </span>
                {feedback.actionableAdvice}
              </p>
            )}
            {gradingResult.teacherReviewNotes && (
              <p>
                <span className="font-semibold">Nhận xét của giáo viên: </span>
                {gradingResult.teacherReviewNotes}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 text-center pt-4">
            <div>
              <p className="font-semibold">Học sinh</p>
              <p className="text-xs text-slate-500 mt-12">(Ký, ghi rõ họ tên)</p>
            </div>
            <div>
              <p className="font-semibold">Giáo viên chấm</p>
              <p className="mt-12">{signer || <span className="text-xs text-slate-500">(Ký, ghi rõ họ tên)</span>}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
