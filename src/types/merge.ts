export class MergeStatus {
  canMerge: boolean;
  conflicted: boolean;
  outcome: string;
  vetoes: {
    summaryMessage: string;
    detailedMessage?: string;
  }[];
}
