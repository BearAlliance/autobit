import * as rm from 'typed-rest-client/RestClient';
import * as hm from 'typed-rest-client/Handlers';
import * as ifm from 'typed-rest-client/Interfaces';
import * as ht from 'typed-rest-client/HttpClient';

import * as prs from './types/prs';
import * as activities from './types/activities';
import { MergeStatus } from './types/merge';
import { HttpUtility } from './httpUtility';
import { PrComposite } from './types/prComposite';
import { Flowdock } from './flowdock';

const MaxMergeRetries = 3;

export enum ChangeType {
  Added,
  Changed,
  Deleted
}

export enum CommentKeyword {
  Mab = 'mab',
  Cancel = 'cancel',
  Notify = 'notify'
}

export const BuildVetoSummaryMessage = 'Not all required builds are successful yet';

export enum BuildStatus {
  NotSpecified = 'The build status isn\t specified',
  InProgress = 'You cannot merge this pull request while it has in-progress builds.',
  Failed = 'You cannot merge this pull request while it has failed builds.',
  NeedMinimumOfOne = 'You need a minimum of one successful build before this pull request can be merged.',
  Successful = 'Successful',
  Other = 'Build status not recognized'
}

export class ChangeComposite {
  composite: PrComposite;
  changeType: ChangeType;
  changeAsString: string;
  oneTimeChangeMessage?: string;
  commentMessage?: string;
}

const postHeaders = {
  "content-type": "application/json"
};

export class BitBucket {
  basicHandler: hm.BasicCredentialHandler;
  http: ht.HttpClient;
  rest: rm.RestClient;

  cachedComposites: PrComposite[] = [];

  loopExecuting = false;
  lastError = null;

  constructor(private username: string, private password: string, private branches: string[], private repository: string, private baseUrl: string, private proxyBypass: string, private proxyUrl, private flowdock: Flowdock) {
    this.basicHandler = new hm.BasicCredentialHandler(username, password);

    this.http = new ht.HttpClient('autobit', [this.basicHandler], { proxy: { proxyBypassHosts: [this.proxyBypass], proxyUrl: this.proxyUrl } });
    this.rest = new rm.RestClient('autobit', baseUrl, [this.basicHandler], { proxy: { proxyBypassHosts: [this.proxyBypass], proxyUrl: this.proxyUrl } });
  }

  async getPrs() {
    let response = await this.rest.get<prs.Prs>(`/${this.repository}/pull-requests?state=OPEN`);
    HttpUtility.validateRestResponse(response);
    return response.result;
  }

  async getActivities(id: number) {
    let response = await this.rest.get<activities.Activities>(`/${this.repository}/pull-requests/${id}/activities?fromType=comment`);
    HttpUtility.validateRestResponse(response);
    return response.result;
  }

  async getMergeStatus(id: number) {
    let response = await this.rest.get<MergeStatus>(`/${this.repository}/pull-requests/${id}/merge`);
    HttpUtility.validateRestResponse(response);
    return response.result;
  }

  async getFilteredPrs() {
    let prs = await this.getPrs();
    return prs.values.filter((pr) => this.branches.find(branch => RegExp(`^${branch}`, 'i').test(pr.toRef.id)));
  }

  async getAllComposites() {
    return await this.getFilteredPrs().then(prs => Promise.all(prs.map(async pr => await this.getCompositeWithMergeStatus(pr))));
  }

  async mergePr(id: number, version: number) {
    let response = await this.http.post(`${this.baseUrl}/${this.repository}/pull-requests/${id}/merge?version=${version}`, '', postHeaders);
    let body = JSON.parse(await response.readBody());
    if (body.errors && body.errors.length > 0 && body.errors[0].message) {
      throw body.errors[0].message;
    }
    HttpUtility.validateHttpResponse(response);
  }

  async postComment(id: number, comment: string) {
    let response = await this.http.post(`${this.baseUrl}/${this.repository}/pull-requests/${id}/comments`, JSON.stringify({ text: comment }), postHeaders);
    HttpUtility.validateHttpResponse(response);
  }

  updateCacheAndReturnDiffs(composites: PrComposite[]): ChangeComposite[] {
    let changes: ChangeComposite[] = [];

    composites.forEach(composite => {
      let existingCachedComposite = this.cachedComposites.find(cachedComposite => cachedComposite.id === composite.id);
      if (!existingCachedComposite) {
        changes.push({ composite, changeType: ChangeType.Added, changeAsString: ChangeType[ChangeType.Added] });
        this.cachedComposites.push(composite);
      } else {
        //always update the cache with the latest composite
        this.cachedComposites.splice(this.cachedComposites.indexOf(existingCachedComposite), 1);
        this.cachedComposites.push(composite);
        //see if anything we care about has changed
        const change: ChangeComposite = { composite, changeType: ChangeType.Changed, changeAsString: ChangeType[ChangeType.Changed] };
        if (existingCachedComposite.lastCommit && composite.lastCommit !== existingCachedComposite.lastCommit) {
          change.oneTimeChangeMessage = 'New commit added';
        }
        if (composite.mostRecentCommentDate !== existingCachedComposite.mostRecentCommentDate) {
          change.commentMessage = 'New comment(s) added from ' + composite.newCommentsFrom.join(' and ');
        }
        if (
          composite.title !== existingCachedComposite.title ||
          composite.approvals !== existingCachedComposite.approvals ||
          composite.needWorks !== existingCachedComposite.needWorks ||
          composite.openTasks !== existingCachedComposite.openTasks ||
          composite.canMerge !== existingCachedComposite.canMerge ||
          composite.isConflicted !== existingCachedComposite.isConflicted ||
          composite.buildStatus !== existingCachedComposite.buildStatus ||
          change.oneTimeChangeMessage ||
          change.commentMessage
        ) {
          //if so, push it into the change array
          changes.push(change);
        };
      }
    });
    //check for deleted composites
    this.cachedComposites.forEach(cachedComposite => {
      let foundItem = composites.find(composite => cachedComposite.id === composite.id);
      if (!foundItem) {
        changes.push({ composite: cachedComposite, changeType: ChangeType.Deleted, changeAsString: ChangeType[ChangeType.Deleted] });
        this.cachedComposites.splice(this.cachedComposites.indexOf(cachedComposite), 1);
      }
    })

    return changes;
  }

  async loop() {
    if (!this.loopExecuting) {
      let currentProcessingStatus: string = 'Starting';
      try {
        console.log('Processing...');
        this.loopExecuting = true;
        let composites = await this.getAllComposites();

        for (let composite of composites) {
          currentProcessingStatus + ' / Title: ' + composite.title;
          let activities = await this.getActivities(composite.id);
          BitBucket.getActionRequestsFromComments(composite, activities.values);
          this.setMostRecentCommentDate(composite, activities.values);

          if (composite.sendMergeRequestNotification) {
            let requestMessage = `Automerge has been ${composite.mergeRequested ? 'requested' : 'canceled'} for ${this.flowdock.createPRNameLink(composite)} by ${composite.lastAutobitActionRequestedBy}`;
            await this.flowdock.postInfo(requestMessage, composite);
            composite.sendMergeRequestNotification = false;
          }

          if (composite.canMerge) {
            if (composite.mergeRequested) {
              let requestMessage = `Automerge in progess for ${composite.title} by ${composite.lastAutobitActionRequestedBy}`;
              let completedMessage = `Automerge completed for ${this.flowdock.createPRNameLink(composite)}`;
              let errorMessage = `Automerge failure with auto-merge for ${this.flowdock.createPRNameLink(composite)}`;
              await this.flowdock.postInfo(requestMessage);
              await this.postComment(composite.id, requestMessage);
              let mergeSucceeded = false;
              let canRetry = composite.mergeRetries < MaxMergeRetries;
              try {
                await this.mergePr(composite.id, composite.version);
                mergeSucceeded = true;
              } catch (ex) {
                errorMessage += `\r\n\`\`\`${ex}\`\`\``;
                if (canRetry) {
                  errorMessage += `\r\nAutobit will retry ${MaxMergeRetries - composite.mergeRetries} more time(s)`;
                } else {
                  errorMessage += `\r\nCanceled`;
                }
                composite.mergeRetries++;
              }
              if (mergeSucceeded) {
                await this.postComment(composite.id, completedMessage);
                await this.flowdock.postInfo(completedMessage);
              } else {
                await this.postComment(composite.id, errorMessage);
                if (!canRetry) {
                  await this.postComment(composite.id, 'cancel');
                }
                if (composite.mergeRetries > 1) {
                  await this.flowdock.postInfo(errorMessage);
                }
              }
            }
          }
        };

        let changes = this.updateCacheAndReturnDiffs(composites);
        changes.forEach(async (change) => {
          change.composite.threadId = await this.flowdock.postChange(change);
          change.oneTimeChangeMessage = null;
          change.commentMessage = null;
        });
        this.lastError = null;
      } catch (ex) {
        let exAsString = ex.toString();
        console.log(`ERROR (${currentProcessingStatus})`, exAsString);
        //don't repeat the same error over and over in the flow
        if (this.lastError != exAsString) {
          await this.flowdock.postError(`Autobit ERROR (${currentProcessingStatus}) --- ${exAsString}`);

          //check for 401 - we don't want to lock an account
          let matches = exAsString.match(/\(([^)]+)\)/);
          if (matches.length > 0) {
            let statusCode = matches[1];
            if (ex == '401') {
              await this.flowdock.postError('Autobit stopped with ERROR ' + ex.statusCode);
              process.exit(ex.statusCode);
            }
          }
          this.lastError = exAsString;
        }
      } finally {
        console.log('Complete...');
        this.loopExecuting = false;
      }
    }
  }

  async getCompositeWithMergeStatus(pr: prs.Value) {
    return this.createComposite(pr, await this.getMergeStatus(pr.id));
  }

  createComposite(pr: prs.Value, merge: MergeStatus) {
    let composite = new PrComposite();
    composite.version = pr.version;
    composite.fromBranch = pr.fromRef;
    composite.toBranch = pr.toRef;
    composite.id = pr.id;
    composite.title = pr.title;
    composite.author = pr.author.user.displayName;
    composite.authorEmail = pr.author.user.emailAddress;
    composite.notificationEmails = [];
    composite.newCommentsFrom = [];
    composite.createdDate = new Date(pr.createdDate);
    composite.updatedDate = new Date(pr.updatedDate);
    composite.approvals = pr.reviewers.filter(reviewer => reviewer.status === 'APPROVED').length;
    composite.needWorks = pr.reviewers.filter(reviewer => reviewer.status === 'NEEDS_WORK').length;
    composite.openTasks = pr.properties.openTaskCount;
    composite.canMerge = merge.canMerge;
    composite.lastCommit = pr.fromRef ? pr.fromRef.latestCommit : null;
    composite.isConflicted = pr.properties.mergeResult && pr.properties.mergeResult.outcome === 'CONFLICTED';
    composite.link = pr.links.self.length > 0 ? pr.links.self[0].href : '';
    this.setBuildStatus(composite, merge);

    let existingCachedComposite = this.cachedComposites.find(cachedComposite => cachedComposite.id === composite.id);
    //carry over the properties that need to persist across composite retrievals
    if (existingCachedComposite) {
      if (!composite.canMerge) {
        composite.mergeRetries = 0;
      } else {
        composite.mergeRetries = existingCachedComposite.mergeRetries;
      }

      composite.mergeRequested = existingCachedComposite.mergeRequested;
      composite.lastAutobitActionRequestedBy = existingCachedComposite.lastAutobitActionRequestedBy;
      composite.threadId = existingCachedComposite.threadId;
    }
    return composite;
  }

  private setBuildStatus(composite: PrComposite, merge: MergeStatus) {
    if (!merge.vetoes) {
      composite.buildStatus = BuildStatus.NotSpecified;
      return;
    }
    const buildVetoMessage = merge.vetoes.find(x => x.summaryMessage === BuildVetoSummaryMessage);
    if (!buildVetoMessage || !buildVetoMessage.detailedMessage) {
      composite.buildStatus = BuildStatus.NotSpecified;
      return;
    }
    if (buildVetoMessage.detailedMessage === BuildStatus.InProgress) {
      composite.buildStatus = BuildStatus.InProgress;
    } else if (buildVetoMessage.detailedMessage === BuildStatus.Failed) {
      composite.buildStatus = BuildStatus.Failed;
    } else if (buildVetoMessage.detailedMessage === BuildStatus.NeedMinimumOfOne) {
      composite.buildStatus = BuildStatus.NeedMinimumOfOne;
    } else {
      composite.buildStatus = BuildStatus.Other;
    }
  }

  private setMostRecentCommentDate(composite: PrComposite, activities: activities.Activity[]) {
    let mostRecentCommentDate = 0;
    let newCommentsFrom = [];
    activities.forEach(activity => {
      if (activity.action === 'COMMENTED') {
        mostRecentCommentDate = this.findMostRecentCommentDate([activity.comment], mostRecentCommentDate, newCommentsFrom);
      }
    })
    composite.mostRecentCommentDate = mostRecentCommentDate;
    composite.newCommentsFrom = newCommentsFrom;
  }

  private findMostRecentCommentDate(comments: activities.Comment[], mostRecent: number = 0, newCommentsFrom: string[]) {
    comments.forEach(comment => {
      if (BitBucket.returnCommentKeyword(comment) === null && comment.author.displayName !== 'autobit') {
        if (comment.createdDate > mostRecent) {
          mostRecent = comment.createdDate;
          if (newCommentsFrom.indexOf(comment.author.emailAddress) === -1) {
            newCommentsFrom.push(comment.author.emailAddress);
          }
        }
      }
      if (comment.comments) {
        mostRecent = this.findMostRecentCommentDate(comment.comments, mostRecent, newCommentsFrom);
      }
    });
    return mostRecent;
  }

  static returnCommentKeyword(comment: activities.Comment): CommentKeyword | null {
    if (comment) {
      const commentText = (comment.text || '').toLowerCase().replace('\n', '').trim();
      if ((<any>Object).values(CommentKeyword).includes(commentText)) {
        return commentText as CommentKeyword;
      }
    }
    return null;
  }

  static getActionRequestsFromComments(composite: PrComposite, activities: activities.Activity[]) {
    let commentFound: activities.Comment = null;
    let originalMergeRequestedStatus = composite.mergeRequested;
    for (let i = 0; i < activities.length - 1; i++) {
      let activity = activities[i];
      const keyword = BitBucket.returnCommentKeyword(activity.comment);
      if (keyword === CommentKeyword.Cancel) {
        composite.mergeRequested = false;
        commentFound = activity.comment;
        break;
      } else if (keyword === CommentKeyword.Mab) {
        composite.mergeRequested = true;
        commentFound = activity.comment;
        break;
      } else if (keyword === CommentKeyword.Notify) {
        if (composite.notificationEmails.indexOf(activity.comment.author.emailAddress) === -1) {
          composite.notificationEmails.push(activity.comment.author.emailAddress);
        }
      }
    }
    if (!commentFound) {
      composite.mergeRequested = false;
    } else {
      composite.lastAutobitActionRequestedBy = commentFound.author.displayName;
    }
    if (composite.mergeRequested != originalMergeRequestedStatus) {
      composite.sendMergeRequestNotification = true;
    }
  }
}
