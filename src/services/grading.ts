import { Exam, GradingResult, Submission } from '../types';
import { AIService } from './aiService';
import { StorageService } from './storage';

export const getLatestResult = (results: GradingResult[], submissionId: string): GradingResult | undefined =>
  results.filter((r) => r.submissionId === submissionId).sort((a, b) => b.version - a.version)[0];

export const effectiveScore = (result: GradingResult): number => result.finalTeacherScore ?? result.aiSuggestedScore;

export const criterionScore = (grade: { teacherScore?: number; suggestedScore: number }): number =>
  grade.teacherScore ?? grade.suggestedScore;

export const sumCriteria = (grades: { teacherScore?: number; suggestedScore: number }[]): number =>
  Math.round(grades.reduce((sum, grade) => sum + (Number(criterionScore(grade)) || 0), 0) * 100) / 100;

export const formatScore = (score: number): string =>
  score.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// Bands are set on a 10-point scale, so other scales are compared by percentage
export type ScoreBand = 'Giỏi' | 'Khá' | 'Trung bình' | 'Yếu';

export function scoreBand(score: number, maxScore: number): ScoreBand {
  const onTen = maxScore > 0 ? (score / maxScore) * 10 : 0;
  if (onTen >= 8) return 'Giỏi';
  if (onTen >= 6.5) return 'Khá';
  if (onTen >= 5) return 'Trung bình';
  return 'Yếu';
}

export const hasAnswerKey = (exam: Exam): boolean =>
  Boolean(exam.guideOrSolution?.trim()) || (exam.referenceFiles?.length ?? 0) > 0;

export const hasExamPrompt = (exam: Exam): boolean =>
  Boolean(exam.prompt?.trim()) || (exam.promptFiles?.length ?? 0) > 0;

export async function gradeSubmission(
  submission: Submission,
  exam: Exam,
  previous?: GradingResult
): Promise<GradingResult> {
  const result = await AIService.gradeEssay({
    examTitle: exam.title,
    gradeLevel: exam.gradeLevel,
    examPrompt: exam.prompt,
    promptFiles: await StorageService.loadAttachmentData(exam.promptFiles),
    examGuide: exam.guideOrSolution,
    referenceFiles: await StorageService.loadAttachmentData(exam.referenceFiles),
    maxScore: exam.maxScore || 10,
    rubricCriteria: exam.criteria || [],
    teacherNotes: exam.teacherNotes,
    submissionContent: submission.content,
    attachments: await StorageService.loadAttachmentData(submission.attachments),
  });

  return {
    ...result,
    submissionId: submission.id,
    examId: exam.id,
    version: previous ? previous.version + 1 : 1,
  };
}
