import { Attachment, AuditLog, Exam, GradingResult, Submission, User } from '../types';
import { LocalDb } from './localDb';
import { base64ToBytes } from './wordExtract';

// Older versions of the app kept everything in localStorage; moved to IndexedDB once on first load
const LEGACY_STORAGE_KEYS = {
  EXAMS: 'gv_van_exams_v1',
  SUBMISSIONS: 'gv_van_submissions_v1',
  GRADING_RESULTS: 'gv_van_grading_results_v1',
  AUDIT_LOGS: 'gv_van_audit_logs_v1',
};

const CURRENT_USER_KEY = 'gv_van_current_user_v1';
const INITIALIZED_FLAG = 'initialized';

// Records earlier versions seeded as demo data. A real exam is kept if real work was filed under it.
const DEMO_EXAM_ID = 'exam-sample-gdpt-11';
const DEMO_SUBMISSION_IDS = ['sub-01', 'sub-02', 'sub-03'];

const EMPTY_USER: User = { name: '', school: '' };

interface ClassroomSnapshot {
  exams: Exam[];
  submissions: Submission[];
  gradingResults: GradingResult[];
  auditLogs: AuditLog[];
}

type CollectionName = keyof ClassroomSnapshot;
type StoredFile = { id: string; file: Blob };

const COLLECTION_NAMES: CollectionName[] = ['exams', 'submissions', 'gradingResults', 'auditLogs'];

// IndexedDB is asynchronous, so this copy keeps the getters synchronous for the components.
// It holds attachment details only: file contents stay in IndexedDB as Blobs.
let cache: ClassroomSnapshot = { exams: [], submissions: [], gradingResults: [], auditLogs: [] };

const fileUrls = new Map<string, string>();

let initPromise: Promise<void> | null = null;
let writeChain: Promise<unknown> = Promise.resolve();
let pendingWrites = 0;
let errorListener: ((message: string | null) => void) | null = null;

function describeStorageError(err: unknown): string {
  return (err as DOMException)?.name === 'QuotaExceededError'
    ? 'Trình duyệt đã hết dung lượng lưu trữ nên thay đổi vừa rồi chưa được lưu. Vui lòng xóa bớt bài làm có tệp đính kèm.'
    : 'Trình duyệt chưa lưu được thay đổi vừa rồi. Vui lòng không đóng trang và thử lại.';
}

// Writes run one at a time, in order. Resolves to whether this write was saved; never rejects.
function enqueueWrite(write: () => Promise<unknown>): Promise<boolean> {
  pendingWrites++;
  const result = writeChain.then(write).then(
    () => {
      errorListener?.(null);
      return true;
    },
    (err) => {
      console.error('Could not save to IndexedDB:', err);
      errorListener?.(describeStorageError(err));
      return false;
    }
  );
  writeChain = result.finally(() => {
    pendingWrites--;
  });
  return result;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((entry) => entry.id === item.id)
    ? list.map((entry) => (entry.id === item.id ? item : entry))
    : [item, ...list];
}

function readLegacyList<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLegacyLocalData(): ClassroomSnapshot | null {
  const exams = readLegacyList<Exam>(LEGACY_STORAGE_KEYS.EXAMS);
  const submissions = readLegacyList<Submission>(LEGACY_STORAGE_KEYS.SUBMISSIONS);
  if (exams.length === 0 && submissions.length === 0) return null;
  return {
    exams,
    submissions,
    gradingResults: readLegacyList<GradingResult>(LEGACY_STORAGE_KEYS.GRADING_RESULTS),
    auditLogs: readLegacyList<AuditLog>(LEGACY_STORAGE_KEYS.AUDIT_LOGS),
  };
}

function withoutDemoRecords(snapshot: ClassroomSnapshot): ClassroomSnapshot {
  const submissions = snapshot.submissions.filter((s) => !DEMO_SUBMISSION_IDS.includes(s.id));
  const demoExamInUse = submissions.some((s) => s.examId === DEMO_EXAM_ID);
  return {
    exams: snapshot.exams.filter((e) => e.id !== DEMO_EXAM_ID || demoExamInUse),
    submissions,
    gradingResults: snapshot.gradingResults.filter((g) => !DEMO_SUBMISSION_IDS.includes(g.submissionId)),
    auditLogs: snapshot.auditLogs.filter((l) => !DEMO_SUBMISSION_IDS.includes(l.submissionId)),
  };
}

function hasSameCounts(a: ClassroomSnapshot, b: ClassroomSnapshot): boolean {
  return COLLECTION_NAMES.every((name) => a[name].length === b[name].length);
}

function readFileAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function showFile(id: string, file: Blob): void {
  const previous = fileUrls.get(id);
  if (previous) URL.revokeObjectURL(previous);
  fileUrls.set(id, URL.createObjectURL(file));
}

function forgetFiles(ids: string[]): void {
  ids.forEach((id) => {
    const url = fileUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    fileUrls.delete(id);
  });
}

// Takes file contents out of a record: they go to IndexedDB as Blobs, the record keeps the details
function separateFiles(list: Attachment[] = []): { attachments: Attachment[]; files: StoredFile[] } {
  const files: StoredFile[] = [];
  const attachments = list.map((attachment) => {
    if (!attachment.base64) return attachment;
    try {
      const file = new Blob([base64ToBytes(attachment.base64) as BlobPart], { type: attachment.mimeType });
      const id = attachment.id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      files.push({ id, file });
      showFile(id, file);
      return { ...attachment, id, base64: '' };
    } catch {
      // Not valid base64: leave it inside the record rather than lose it
      return attachment;
    }
  });
  return { attachments, files };
}

function findRemovedIds(previous: Attachment[] = [], next: Attachment[]): string[] {
  return previous.map((attachment) => attachment.id).filter((id) => !next.some((attachment) => attachment.id === id));
}

function fileIdsOf(attachments: Attachment[] = []): string[] {
  return attachments.map((attachment) => attachment.id);
}

async function writeWithFiles(names: CollectionName[], files: StoredFile[], removedIds: string[]): Promise<void> {
  for (const { id, file } of files) {
    await LocalDb.putFile(id, file);
  }
  await Promise.all(names.map((name) => LocalDb.putCollection(name, cache[name])));
  if (removedIds.length > 0) await LocalDb.deleteFiles(removedIds);
}

async function loadSnapshot(): Promise<void> {
  const [initialized, exams, submissions, gradingResults, auditLogs] = await Promise.all([
    LocalDb.getCollection<boolean>(INITIALIZED_FLAG),
    LocalDb.getCollection<Exam[]>('exams'),
    LocalDb.getCollection<Submission[]>('submissions'),
    LocalDb.getCollection<GradingResult[]>('gradingResults'),
    LocalDb.getCollection<AuditLog[]>('auditLogs'),
  ]);

  if (initialized) {
    const stored: ClassroomSnapshot = {
      exams: exams || [],
      submissions: submissions || [],
      gradingResults: gradingResults || [],
      auditLogs: auditLogs || [],
    };
    cache = withoutDemoRecords(stored);
    if (!hasSameCounts(stored, cache)) {
      await writeWithFiles(COLLECTION_NAMES, [], []);
    }
    (await LocalDb.getAllFiles()).forEach(({ id, file }) => showFile(id, file));
    return;
  }

  const legacy = readLegacyLocalData();
  const initial = withoutDemoRecords(legacy ?? { exams: [], submissions: [], gradingResults: [], auditLogs: [] });
  const separated = initial.submissions.map((submission) => separateFiles(submission.attachments));
  cache = {
    ...initial,
    submissions: initial.submissions.map((submission, index) => ({
      ...submission,
      attachments: separated[index].attachments,
    })),
  };

  await writeWithFiles(COLLECTION_NAMES, separated.flatMap((entry) => entry.files), []);
  await LocalDb.putCollection(INITIALIZED_FLAG, true);

  // Only now that the data is safely stored: old copies can fill localStorage and block saving the API key
  if (legacy) {
    Object.values(LEGACY_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }
}

// Where the browser can show or download an attachment from
export function attachmentHref(attachment: Attachment): string {
  return fileUrls.get(attachment.id) || attachment.base64;
}

export const StorageService = {
  // Called once at startup, before the first screen is shown
  init(): Promise<void> {
    initPromise ??= loadSnapshot()
      .catch((err) => {
        console.error('Could not open IndexedDB:', err);
        errorListener?.(
          'Trình duyệt không cho lưu dữ liệu (có thể do cửa sổ ẩn danh), nên mọi thay đổi sẽ mất khi đóng trang.'
        );
      })
      .finally(() => {
        // Asks the browser not to clear this site's data when the disk runs low
        navigator.storage?.persist?.().catch(() => undefined);
      });
    return initPromise;
  },

  setErrorListener(listener: ((message: string | null) => void) | null): void {
    errorListener = listener;
  },

  hasPendingWrites(): boolean {
    return pendingWrites > 0;
  },

  // Fills in the file contents for attachments kept in IndexedDB
  async loadAttachmentData(attachments: Attachment[] = []): Promise<Attachment[]> {
    await writeChain;
    return Promise.all(
      attachments.map(async (attachment) => {
        if (attachment.base64) return attachment;
        const file = await LocalDb.getFile(attachment.id);
        if (!file) throw new Error(`Không tìm thấy tệp "${attachment.name}" trong trình duyệt này.`);
        return { ...attachment, base64: await readFileAsDataUrl(file) };
      })
    );
  },

  // Exams
  getExams(): Exam[] {
    return cache.exams;
  },

  saveExam(exam: Exam): void {
    const previous = cache.exams.find((e) => e.id === exam.id);
    const prompts = separateFiles(exam.promptFiles);
    const references = separateFiles(exam.referenceFiles);
    const removedIds = [
      ...findRemovedIds(previous?.promptFiles, prompts.attachments),
      ...findRemovedIds(previous?.referenceFiles, references.attachments),
    ];
    const now = new Date().toISOString();
    const saved: Exam = {
      ...exam,
      promptFiles: prompts.attachments,
      referenceFiles: references.attachments,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
    };

    cache = { ...cache, exams: upsert(cache.exams, saved) };
    forgetFiles(removedIds);
    void enqueueWrite(() => writeWithFiles(['exams'], [...prompts.files, ...references.files], removedIds));
  },

  // Removes the exam together with everything filed under it
  deleteExam(id: string): void {
    const exam = cache.exams.find((e) => e.id === id);
    const submissions = cache.submissions.filter((s) => s.examId === id);
    const submissionIds = submissions.map((s) => s.id);
    const fileIds = [
      ...fileIdsOf(exam?.promptFiles),
      ...fileIdsOf(exam?.referenceFiles),
      ...submissions.flatMap((s) => fileIdsOf(s.attachments)),
    ];

    cache = {
      exams: cache.exams.filter((e) => e.id !== id),
      submissions: cache.submissions.filter((s) => s.examId !== id),
      gradingResults: cache.gradingResults.filter((g) => !submissionIds.includes(g.submissionId)),
      auditLogs: cache.auditLogs.filter((l) => !submissionIds.includes(l.submissionId)),
    };
    forgetFiles(fileIds);
    void enqueueWrite(() => writeWithFiles(COLLECTION_NAMES, [], fileIds));
  },

  // Submissions
  getSubmissions(): Submission[] {
    return cache.submissions;
  },

  // Resolves to false if the browser could not store it; the reason also goes to the error listener
  saveSubmission(submission: Submission): Promise<boolean> {
    const previous = cache.submissions.find((s) => s.id === submission.id);
    const { attachments, files } = separateFiles(submission.attachments);
    const removedIds = findRemovedIds(previous?.attachments, attachments);

    cache = { ...cache, submissions: upsert(cache.submissions, { ...submission, attachments }) };
    forgetFiles(removedIds);

    return enqueueWrite(() => writeWithFiles(['submissions'], files, removedIds));
  },

  // Removes the essay together with its grades and history
  deleteSubmission(id: string): void {
    const fileIds = fileIdsOf(cache.submissions.find((s) => s.id === id)?.attachments);
    cache = {
      ...cache,
      submissions: cache.submissions.filter((s) => s.id !== id),
      gradingResults: cache.gradingResults.filter((g) => g.submissionId !== id),
      auditLogs: cache.auditLogs.filter((l) => l.submissionId !== id),
    };
    forgetFiles(fileIds);
    void enqueueWrite(() => writeWithFiles(['submissions', 'gradingResults', 'auditLogs'], [], fileIds));
  },

  // Grading Results
  getGradingResults(): GradingResult[] {
    return cache.gradingResults;
  },

  saveGradingResult(result: GradingResult): void {
    cache = { ...cache, gradingResults: upsert(cache.gradingResults, result) };
    void enqueueWrite(() => LocalDb.putCollection('gradingResults', cache.gradingResults));

    // Update submission status and current score
    const submission = cache.submissions.find((s) => s.id === result.submissionId);
    if (submission) {
      void this.saveSubmission({
        ...submission,
        status: result.status === 'Đã duyệt' ? 'da_duyet' : 'cho_duyet',
        currentScore: result.finalTeacherScore ?? result.aiSuggestedScore,
        gradingResultId: result.id,
      });
    }
  },

  // Audit Logs
  getAuditLogs(): AuditLog[] {
    return cache.auditLogs;
  },

  addAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const newEntry: AuditLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    cache = { ...cache, auditLogs: [newEntry, ...cache.auditLogs] };
    void enqueueWrite(() => LocalDb.putCollection('auditLogs', cache.auditLogs));
  },

  // User
  getCurrentUser(): User {
    try {
      const user = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
      return user ? { name: user.name || '', school: user.school || '' } : EMPTY_USER;
    } catch {
      return EMPTY_USER;
    }
  },

  saveCurrentUser(user: User): void {
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('Could not save teacher profile:', (err as Error)?.name);
    }
  },
};
