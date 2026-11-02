import { useCallback, useRef, useState } from 'react';
import { AiRequestError } from '../services/aiService';
import { Submission } from '../types';

export interface GradingQueueState {
  isRunning: boolean;
  currentId: string | null;
  queuedIds: string[];
  doneCount: number;
  total: number;
  failures: Record<string, string>;
  // Why the whole run stopped, when the remaining essays would fail the same way
  stopReason: string | null;
}

const IDLE: GradingQueueState = {
  isRunning: false,
  currentId: null,
  queuedIds: [],
  doneCount: 0,
  total: 0,
  failures: {},
  stopReason: null,
};

const STOPS_THE_RUN = ['NO_API_KEY', 'INVALID_API_KEY', 'PERMISSION_DENIED', 'QUOTA_EXCEEDED', 'RATE_LIMIT', 'NETWORK_ERROR'];
const NEEDS_API_KEY = ['NO_API_KEY', 'INVALID_API_KEY'];

// Lives above the steps, so grading keeps going while the teacher looks at another step.
// One essay at a time: a free API key would hit its rate limit quickly otherwise.
export function useGradingQueue(
  gradeOne: (submission: Submission) => Promise<void>,
  onNeedApiKey: () => void
) {
  const [state, setState] = useState<GradingQueueState>(IDLE);
  const isRunningRef = useRef(false);
  const stopRequestedRef = useRef(false);

  const start = useCallback(
    async (submissions: Submission[]) => {
      if (isRunningRef.current || submissions.length === 0) return;
      isRunningRef.current = true;
      stopRequestedRef.current = false;

      const ids = submissions.map((s) => s.id);
      setState((prev) => ({
        isRunning: true,
        currentId: null,
        queuedIds: ids,
        doneCount: 0,
        total: ids.length,
        failures: Object.fromEntries(Object.entries(prev.failures).filter(([id]) => !ids.includes(id))),
        stopReason: null,
      }));

      for (const submission of submissions) {
        if (stopRequestedRef.current) break;
        setState((prev) => ({
          ...prev,
          currentId: submission.id,
          queuedIds: prev.queuedIds.filter((id) => id !== submission.id),
        }));

        try {
          await gradeOne(submission);
          setState((prev) => ({ ...prev, doneCount: prev.doneCount + 1 }));
        } catch (err: any) {
          console.error(err);
          const message = err?.message || 'Đã xảy ra lỗi khi AI chấm bài này.';
          const errorType = err instanceof AiRequestError ? err.errorType : 'UNKNOWN';
          setState((prev) => ({ ...prev, failures: { ...prev.failures, [submission.id]: message } }));

          if (STOPS_THE_RUN.includes(errorType)) {
            setState((prev) => ({ ...prev, stopReason: message }));
            if (NEEDS_API_KEY.includes(errorType)) onNeedApiKey();
            break;
          }
        }
      }

      isRunningRef.current = false;
      setState((prev) => ({ ...prev, isRunning: false, currentId: null, queuedIds: [] }));
    },
    [gradeOne, onNeedApiKey]
  );

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    setState((prev) => ({ ...prev, queuedIds: [] }));
  }, []);

  return { queue: state, startGrading: start, stopGrading: stop };
}
