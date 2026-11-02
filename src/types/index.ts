/**
 * Data structures for the literature grading assistant
 */

export interface User {
  name: string;
  school: string;
}

export type GradeLevel = '10' | '11' | '12';

export interface RubricCriterion {
  id: string;
  section: string;
  title: string;
  maxScore: number;
  description: string;
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  base64: string; // Data URL or base64; empty once the file is stored in IndexedDB
}

export interface Exam {
  id: string;
  title: string;
  gradeLevel: GradeLevel;
  school: string;
  classes: string[];
  prompt: string; // Exam questions typed by the teacher
  promptFiles?: Attachment[]; // Exam questions as Word, PDF or photos
  guideOrSolution: string; // Answer key, solution or score breakdown typed by the teacher
  referenceFiles?: Attachment[]; // Answer key, solution or score breakdown as files
  maxScore: number;
  criteria: RubricCriterion[];
  teacherNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubmissionStatus = 'chua_cham' | 'dang_cham' | 'cho_duyet' | 'da_duyet';

export interface Submission {
  id: string;
  examId: string;
  studentName: string;
  studentClass: string;
  school: string;
  studentCode?: string;
  submittedAt: string;
  content: string; // Typed text, or the text read from Word files
  attachments: Attachment[];
  status: SubmissionStatus;
  currentScore?: number;
  gradingResultId?: string;
}

export interface CriterionGrade {
  id: string;
  section: string;
  criterion: string;
  maxScore: number;
  suggestedScore: number;
  teacherScore?: number;
  reason: string;
  quoteOrEvidence?: string;
}

export interface ErrorDetail {
  type: string;
  description: string;
  suggestion: string;
}

export interface GeneralFeedback {
  overallComment: string;
  strengths: string[];
  weaknesses: string[];
  errorsToCorrect: ErrorDetail[];
  actionableAdvice: string;
}

export interface GradingResult {
  id: string;
  submissionId: string;
  examId: string;
  version: number;
  gradedAt: string;
  gradedBy: string;
  totalMaxScore: number;
  aiSuggestedScore: number;
  finalTeacherScore?: number;
  status: 'Chờ giáo viên duyệt' | 'Đã duyệt';
  approvedAt?: string;
  approvedBy?: string;
  criteriaGrades: CriterionGrade[];
  generalFeedback: GeneralFeedback;
  rubricCoverageCheck?: string;
  teacherReviewNotes?: string;
}

export type AuditAction = 'CHẤM_LẦN_ĐẦU' | 'CHẤM_LẠI' | 'SỬA_ĐIỂM' | 'DUYỆT_ĐIỂM' | 'HỦY_DUYỆT';

export interface AuditLog {
  id: string;
  submissionId: string;
  gradingResultId: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: AuditAction;
  oldScore?: number;
  newScore?: number;
  details: string;
}
