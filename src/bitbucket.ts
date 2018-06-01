import * as rm from 'typed-rest-client/RestClient';
import * as hm from 'typed-rest-client/Handlers';
import * as ifm from 'typed-rest-client/Interfaces';
import * as ht from 'typed-rest-client/HttpClient';

import * as prs from './types/prs';
import * as activities from './types/activities';
import { MergeStatus } from './types/merge';
import { HttpUtility} from './httpUtility';
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

  constructor(private username: string, private password: string, private branch: string, private baseUrl: string, private proxyBypass: string, private proxyUrl, private flowdock: Flowdock) {
    this.basicHandler = new hm.BasicCredentialHandler(username, password);

    this.http = new ht.HttpClient('autobit', [this.basicHandler], { proxy: { proxyBypassHosts: [this.proxyBypass], proxyUrl: this.proxyUrl } });
    this.rest = new rm.RestClient('autobit', baseUrl, [this.basicHandler], { proxy: { proxyBypassHosts: [this.proxyBypass], proxyUrl: this.proxyUrl } });
  }

  async getPrs() {
    let response = await this.rest.get<prs.Prs>('/dashboard/pull-requests?state=OPEN&role=REVIEWER');
    return response.result;
  }

  async getActivities(id: number) {
    let response = await this.rest.get<activities.Activities>(`/projects/RED/repos/redbox-spa/pull-requests/${id}/activities?fromType=comment`);
    return response.result;
  }

  async getMergeStatus(id: number) {
    let response = await this.rest.get<MergeStatus>(`/projects/RED/repos/redbox-spa/pull-requests/${id}/merge`);
    return response.result;
  }

  async getFilteredPrs() {
    let prs = await this.getPrs();
    return prs.values.filter((pr) => pr.toRef.id === this.branch);
  }

  async getAllComposites() {
    return await this.getFilteredPrs().then(prs => Promise.all(prs.map(async pr => await this.getCompositeWithMergeStatus(pr))));
  }

  async mergePr(id: number, version: number) {
    let response = await this.http.post(`${this.baseUrl}/projects/RED/repos/redbox-spa/pull-requests/${id}/merge?version=${version}`, '', postHeaders);
    HttpUtility.validatePostResponse(response);
  }

  async postComment(id: number, comment: string) {
    let response = await this.http.post(`${this.baseUrl}/projects/RED/repos/redbox-spa/pull-requests/${id}/comments`, JSON.stringify({ text: comment }), postHeaders);
    HttpUtility.validatePostResponse(response);
  }

  updateCacheAndReturnDiffs(composites: PrComposite[]): ChangeComposite[] {
    let changes: ChangeComposite[] = [];

    composites.forEach(composite => {
      let existingCachedComposite = this.cachedComposites.find(cachedComposite => cachedComposite.id === composite.id);
      if (!existingCachedComposite) {
        changes.push({ composite, changeType: ChangeType.Added, changeAsString: ChangeType[ChangeType.Added] });
        this.cachedComposites.push(composite);
      } else if (
        composite.mergeRequested !== existingCachedComposite.mergeRequested ||
        composite.title !== existingCachedComposite.title ||
        composite.updatedDate.toISOString() !== existingCachedComposite.updatedDate.toISOString() ||
        composite.approvals !== existingCachedComposite.approvals ||
        composite.needWorks !== existingCachedComposite.needWorks ||
        composite.openTasks !== existingCachedComposite.openTasks ||
        composite.canMerge !== existingCachedComposite.canMerge ||
        composite.isConflicted !== existingCachedComposite.isConflicted
      ) {
        changes.push({ composite, changeType: ChangeType.Changed, changeAsString: ChangeType[ChangeType.Changed] });
        this.cachedComposites.splice(this.cachedComposites.indexOf(existingCachedComposite), 1);
        this.cachedComposites.push(composite);
      };
    });
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
      try {
        console.log('Processing...');
        this.loopExecuting = true;
        let composites = await this.getAllComposites();

        for (let composite of composites) {
          if (composite.canMerge) {
            let activities = await this.getActivities(composite.id);
            BitBucket.updateCompositeFromActivities(composite, activities.values);
            if (composite.mergeRequested) {
              let requestMessage = `Automerge requested for ${composite.title}`;
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
        changes.forEach(async (change) => await this.flowdock.postChange(change));
        console.log(changes);
      } catch (ex) {
        console.log('ERROR', ex);
        if (ex.statusCode == '401') {
          await this.flowdock.postError('Autobit stopped with ERROR ' + ex.statusCode);
          process.exit(ex.statusCode);
        }
      } finally {
        console.log('Complete...');
        this.loopExecuting = false;
      }
    }
  }

  async getCompositeWithMergeStatus(pr: prs.Value) {
    return BitBucket.createComposite(pr, await this.getMergeStatus(pr.id));
  }

  static createComposite(pr: prs.Value, merge: MergeStatus) {
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

    return composite;
  }

  static updateCompositeFromActivities(composite: PrComposite, activities: activities.Activity[]) {
    composite.mergeRequested = false;
    for (let i = 0; i < activities.length - 1; i++) {
      let activity = activities[i];
      if (activity.comment) {
        if (activity.comment.text === 'cancel') {
          break;
        } else if (activity.comment.text === 'mab') {
          composite.mergeRequested = true;
          break;
        }
      }
    }
  }
}
