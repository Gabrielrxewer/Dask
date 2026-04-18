export type JobName =
  | 'ai.improve-description'
  | 'ai.generate-embedding'
  | 'search.index-item'
  | 'automation.run-rule'
  | 'automation.process-event'
  | 'fiscal.reconcile-pending'
  | 'fiscal.sync-received';

export type JobEnqueueOptions = {
  jobId?: string;
};

export interface JobQueue {
  enqueue<TPayload extends object>(
    jobName: JobName,
    payload: TPayload,
    options?: JobEnqueueOptions
  ): Promise<void>;
}
