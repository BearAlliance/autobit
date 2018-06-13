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

export enum ChangeType {
  Added,
  Changed,
  Deleted
}

export class ChangeComposite {
  composite: PrComposite;
  changeType: ChangeType;
  changeAsString: string;
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
    return prs.values.filter((pr) => this.branches.indexOf(pr.toRef.id) != -1);
  }

  async getAllComposites() {
    return await this.getFilteredPrs().then(prs => Promise.all(prs.map(async pr => await this.getCompositeWithMergeStatus(pr))));
  }

  async mergePr(id: number, version: number) {
    let response = await this.http.post(`${this.baseUrl}/${this.repository}/pull-requests/${id}/merge?version=${version}`, '', postHeaders);
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
        if (
          composite.title !== existingCachedComposite.title ||
          composite.approvals !== existingCachedComposite.approvals ||
          composite.needWorks !== existingCachedComposite.needWorks ||
          composite.openTasks !== existingCachedComposite.openTasks ||
          composite.canMerge !== existingCachedComposite.canMerge ||
          composite.isConflicted !== existingCachedComposite.isConflicted
        ) {
          //if so, push it into the change array
          changes.push({ composite, changeType: ChangeType.Changed, changeAsString: ChangeType[ChangeType.Changed] });
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
          currentProcessingStatus +' / Title: ' + composite.title;
          let activities = await this.getActivities(composite.id);
          BitBucket.updateCompositeFromActivities(composite, activities.values);

          if (composite.sendMergeRequestNotification) {
            let requestMessage = `Automerge has been ${composite.mergeRequested ? 'requested' : 'canceled'} for ${this.flowdock.createPRNameLink(composite)} by ${composite.lastAutobitActionRequestedBy}`;
            await this.flowdock.postInfo(requestMessage, composite);
            composite.sendMergeRequestNotification = false;
          }

          if (composite.canMerge) {
            if (composite.mergeRequested) {
              let requestMessage = `Automerge in progess for ${composite.title} by ${composite.lastAutobitActionRequestedBy}`;
              let completedMessage = `Automerge completed for ${composite.title}`;
              await this.flowdock.postInfo(requestMessage);
              await this.postComment(composite.id, requestMessage);
              await this.mergePr(composite.id, composite.version);
              await this.postComment(composite.id, completedMessage);
              await this.flowdock.postInfo(completedMessage);
            }
          }
        };

        let changes = this.updateCacheAndReturnDiffs(composites);
        changes.forEach(async (change) => {
          change.composite.threadId = await this.flowdock.postChange(change)
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
    composite.id = pr.id;
    composite.title = pr.title;
    composite.author = pr.author.user.displayName;
    composite.createdDate = new Date(pr.createdDate);
    composite.updatedDate = new Date(pr.updatedDate);
    composite.approvals = pr.reviewers.filter(reviewer => reviewer.status === 'APPROVED').length;
    composite.needWorks = pr.reviewers.filter(reviewer => reviewer.status === 'NEEDS_WORK').length;
    composite.openTasks = pr.properties.openTaskCount;
    composite.canMerge = merge.canMerge;
    composite.isConflicted = pr.properties.mergeResult.outcome === 'CONFLICTED';
    composite.link = pr.links.self.length > 0 ? pr.links.self[0].href : '';

    let existingCachedComposite = this.cachedComposites.find(cachedComposite => cachedComposite.id === composite.id);
    //carry over the properties that need to persist across composite retrievals
    if (existingCachedComposite) {
      composite.mergeRequested = existingCachedComposite.mergeRequested;
      composite.lastAutobitActionRequestedBy = existingCachedComposite.lastAutobitActionRequestedBy;
      composite.threadId = existingCachedComposite.threadId;
    }
    return composite;
  }

  static updateCompositeFromActivities(composite: PrComposite, activities: activities.Activity[]) {
    let commentFound: activities.Comment = null;
    let originalMergeRequestedStatus = composite.mergeRequested;
    for (let i = 0; i < activities.length - 1; i++) {
      let activity = activities[i];
      if (activity.comment) {
        if (activity.comment.text === 'cancel') {
          composite.mergeRequested = false;
          commentFound = activity.comment;
          break;
        } else if (activity.comment.text === 'mab') {
          composite.mergeRequested = true;
          commentFound = activity.comment;
          break;
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
