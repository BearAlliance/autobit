import { FromRef } from "./prs";

export class PrComposite {
  version: number;
  fromBranch: FromRef;
  toBranch: FromRef;
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