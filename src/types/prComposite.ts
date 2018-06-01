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
  isConflicted: boolean;
  mergeRequested = false;
}