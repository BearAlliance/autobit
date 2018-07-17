export class PrComposite {
  version: number;
  id: number;
  title: string;
  createdDate: Date;
  updatedDate: Date;
  author: string;
  openTasks: number;
  approvals: number;
  needWorks: number;
  canMerge: boolean;
  mergeRetries = 0;
  isConflicted: boolean;
  mergeRequested = false;
  link: string;
  lastAutobitActionRequestedBy: string;
  sendMergeRequestNotification: boolean;
  threadId: string;
}