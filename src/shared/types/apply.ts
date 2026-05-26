export type ApplyStatus = 'pending_review' | 'awaiting_answers' | 'submitted' | 'cancelled' | 'failed';

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
}

// phase 2: video recording path, LinkedIn Easy Apply modal flag
