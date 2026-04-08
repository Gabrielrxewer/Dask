export type JobName =
  | 'ai.improve-description'
  | 'ai.generate-embedding'
  | 'search.index-item'
  | 'automation.run-rule';

export interface JobQueue {
  enqueue<TPayload extends object>(jobName: JobName, payload: TPayload): Promise<void>;
}
