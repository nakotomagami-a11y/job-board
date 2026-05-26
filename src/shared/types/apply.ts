export type ApplyStatus =
  | 'processing'        // Playwright actively filling — blocks new drafts
  | 'awaiting_answers'
  | 'pending_review'
  | 'submitted'
  | 'cancelled'
  | 'failed';

export interface UnansweredQuestion {
  questionText: string;
  suggestedKey?: string;
  suggestedType?: string;
}

export interface ApplyQueueEntry {
  draftId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  applyUrl: string;
  status: ApplyStatus;
  screenshotPath: string;
  createdAt: string;
  sessionId: string;
  submittedAt?: string;
  postSubmitScreenshotPath?: string;
  unansweredQuestions?: UnansweredQuestion[];
  batchId?: string;
  processingStartedAt?: string;
}

// phase 3: video recording path, LinkedIn Easy Apply modal flag
