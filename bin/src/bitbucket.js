"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rm = require("typed-rest-client/RestClient");
const hm = require("typed-rest-client/Handlers");
const ht = require("typed-rest-client/HttpClient");
const httpUtility_1 = require("./httpUtility");
const prComposite_1 = require("./types/prComposite");
const MaxMergeRetries = 3;
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["Added"] = 0] = "Added";
    ChangeType[ChangeType["Changed"] = 1] = "Changed";
    ChangeType[ChangeType["Deleted"] = 2] = "Deleted";
})(ChangeType = exports.ChangeType || (exports.ChangeType = {}));
exports.BuildVetoSummaryMessage = 'Not all required builds are successful yet';
var BuildStatus;
(function (BuildStatus) {
    BuildStatus["NotSpecified"] = "The build status isn\t specified";
    BuildStatus["InProgress"] = "You cannot merge this pull request while it has in-progress builds.";
    BuildStatus["Failed"] = "You cannot merge this pull request while it has failed builds.";
    BuildStatus["NeedMinimumOfOne"] = "You need a minimum of one successful build before this pull request can be merged.";
    BuildStatus["Successful"] = "Successful";
    BuildStatus["Other"] = "Build status not recognized";
})(BuildStatus = exports.BuildStatus || (exports.BuildStatus = {}));
class ChangeComposite {
}
exports.ChangeComposite = ChangeComposite;
const postHeaders = {
    "content-type": "application/json"
};
class BitBucket {
    constructor(username, password, branches, repository, baseUrl, proxyBypass, proxyUrl, flowdock) {
        this.username = username;
        this.password = password;
        this.branches = branches;
        this.repository = repository;
        this.baseUrl = baseUrl;
        this.proxyBypass = proxyBypass;
        this.proxyUrl = proxyUrl;
        this.flowdock = flowdock;
        this.cachedComposites = [];
        this.loopExecuting = false;
        this.lastError = null;
        this.basicHandler = new hm.BasicCredentialHandler(username, password);
        this.http = new ht.HttpClient('autobit', [this.basicHandler], { proxy: { proxyBypassHosts: [this.proxyBypass], proxyUrl: this.proxyUrl } });
        this.rest = new rm.RestClient('autobit', baseUrl, [this.basicHandler], { proxy: { proxyBypassHosts: [this.proxyBypass], proxyUrl: this.proxyUrl } });
    }
    getPrs() {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.rest.get(`/${this.repository}/pull-requests?state=OPEN`);
            httpUtility_1.HttpUtility.validateRestResponse(response);
            return response.result;
        });
    }
    getActivities(id) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.rest.get(`/${this.repository}/pull-requests/${id}/activities?fromType=comment`);
            httpUtility_1.HttpUtility.validateRestResponse(response);
            return response.result;
        });
    }
    getMergeStatus(id) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.rest.get(`/${this.repository}/pull-requests/${id}/merge`);
            httpUtility_1.HttpUtility.validateRestResponse(response);
            return response.result;
        });
    }
    getFilteredPrs() {
        return __awaiter(this, void 0, void 0, function* () {
            let prs = yield this.getPrs();
            return prs.values.filter((pr) => this.branches.find(branch => RegExp(`^${branch}`, 'i').test(pr.toRef.id)));
        });
    }
    getAllComposites() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getFilteredPrs().then(prs => Promise.all(prs.map((pr) => __awaiter(this, void 0, void 0, function* () { return yield this.getCompositeWithMergeStatus(pr); }))));
        });
    }
    mergePr(id, version) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.http.post(`${this.baseUrl}/${this.repository}/pull-requests/${id}/merge?version=${version}`, '', postHeaders);
            let body = JSON.parse(yield response.readBody());
            if (body.errors && body.errors.length > 0 && body.errors[0].message) {
                throw body.errors[0].message;
            }
            httpUtility_1.HttpUtility.validateHttpResponse(response);
        });
    }
    postComment(id, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.http.post(`${this.baseUrl}/${this.repository}/pull-requests/${id}/comments`, JSON.stringify({ text: comment }), postHeaders);
            httpUtility_1.HttpUtility.validateHttpResponse(response);
        });
    }
    updateCacheAndReturnDiffs(composites) {
        let changes = [];
        composites.forEach(composite => {
            let existingCachedComposite = this.cachedComposites.find(cachedComposite => cachedComposite.id === composite.id);
            if (!existingCachedComposite) {
                changes.push({ composite, changeType: ChangeType.Added, changeAsString: ChangeType[ChangeType.Added] });
                this.cachedComposites.push(composite);
            }
            else {
                //always update the cache with the latest composite
                this.cachedComposites.splice(this.cachedComposites.indexOf(existingCachedComposite), 1);
                this.cachedComposites.push(composite);
                //see if anything we care about has changed
                const change = { composite, changeType: ChangeType.Changed, changeAsString: ChangeType[ChangeType.Changed] };
                if (existingCachedComposite.lastCommit && composite.lastCommit !== existingCachedComposite.lastCommit) {
                    change.oneTimeChangeMessage = 'New commit added';
                }
                if (composite.title !== existingCachedComposite.title ||
                    composite.approvals !== existingCachedComposite.approvals ||
                    composite.needWorks !== existingCachedComposite.needWorks ||
                    composite.openTasks !== existingCachedComposite.openTasks ||
                    composite.canMerge !== existingCachedComposite.canMerge ||
                    composite.isConflicted !== existingCachedComposite.isConflicted ||
                    composite.buildStatus !== existingCachedComposite.buildStatus ||
                    change.oneTimeChangeMessage) {
                    //if so, push it into the change array
                    changes.push(change);
                }
                ;
            }
        });
        //check for deleted composites
        this.cachedComposites.forEach(cachedComposite => {
            let foundItem = composites.find(composite => cachedComposite.id === composite.id);
            if (!foundItem) {
                changes.push({ composite: cachedComposite, changeType: ChangeType.Deleted, changeAsString: ChangeType[ChangeType.Deleted] });
                this.cachedComposites.splice(this.cachedComposites.indexOf(cachedComposite), 1);
            }
        });
        return changes;
    }
    loop() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.loopExecuting) {
                let currentProcessingStatus = 'Starting';
                try {
                    console.log('Processing...');
                    this.loopExecuting = true;
                    let composites = yield this.getAllComposites();
                    for (let composite of composites) {
                        currentProcessingStatus + ' / Title: ' + composite.title;
                        let activities = yield this.getActivities(composite.id);
                        BitBucket.updateCompositeFromActivities(composite, activities.values);
                        if (composite.sendMergeRequestNotification) {
                            let requestMessage = `Automerge has been ${composite.mergeRequested ? 'requested' : 'canceled'} for ${this.flowdock.createPRNameLink(composite)} by ${composite.lastAutobitActionRequestedBy}`;
                            yield this.flowdock.postInfo(requestMessage, composite);
                            composite.sendMergeRequestNotification = false;
                        }
                        if (composite.canMerge) {
                            if (composite.mergeRequested) {
                                let requestMessage = `Automerge in progess for ${composite.title} by ${composite.lastAutobitActionRequestedBy}`;
                                let completedMessage = `Automerge completed for ${this.flowdock.createPRNameLink(composite)}`;
                                let errorMessage = `Automerge failure with auto-merge for ${this.flowdock.createPRNameLink(composite)}`;
                                yield this.flowdock.postInfo(requestMessage);
                                yield this.postComment(composite.id, requestMessage);
                                let mergeSucceeded = false;
                                let canRetry = composite.mergeRetries < MaxMergeRetries;
                                try {
                                    yield this.mergePr(composite.id, composite.version);
                                    mergeSucceeded = true;
                                }
                                catch (ex) {
                                    errorMessage += `\r\n\`\`\`${ex}\`\`\``;
                                    if (canRetry) {
                                        errorMessage += `\r\nAutobit will retry ${MaxMergeRetries - composite.mergeRetries} more time(s)`;
                                    }
                                    else {
                                        errorMessage += `\r\nCanceled`;
                                    }
                                    composite.mergeRetries++;
                                }
                                if (mergeSucceeded) {
                                    yield this.postComment(composite.id, completedMessage);
                                    yield this.flowdock.postInfo(completedMessage);
                                }
                                else {
                                    yield this.postComment(composite.id, errorMessage);
                                    if (!canRetry) {
                                        yield this.postComment(composite.id, 'cancel');
                                    }
                                    if (composite.mergeRetries > 1) {
                                        yield this.flowdock.postInfo(errorMessage);
                                    }
                                }
                            }
                        }
                    }
                    ;
                    let changes = this.updateCacheAndReturnDiffs(composites);
                    changes.forEach((change) => __awaiter(this, void 0, void 0, function* () {
                        change.composite.threadId = yield this.flowdock.postChange(change);
                        change.oneTimeChangeMessage = null;
                    }));
                    this.lastError = null;
                }
                catch (ex) {
                    let exAsString = ex.toString();
                    console.log(`ERROR (${currentProcessingStatus})`, exAsString);
                    //don't repeat the same error over and over in the flow
                    if (this.lastError != exAsString) {
                        yield this.flowdock.postError(`Autobit ERROR (${currentProcessingStatus}) --- ${exAsString}`);
                        //check for 401 - we don't want to lock an account
                        let matches = exAsString.match(/\(([^)]+)\)/);
                        if (matches.length > 0) {
                            let statusCode = matches[1];
                            if (ex == '401') {
                                yield this.flowdock.postError('Autobit stopped with ERROR ' + ex.statusCode);
                                process.exit(ex.statusCode);
                            }
                        }
                        this.lastError = exAsString;
                    }
                }
                finally {
                    console.log('Complete...');
                    this.loopExecuting = false;
                }
            }
        });
    }
    getCompositeWithMergeStatus(pr) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.createComposite(pr, yield this.getMergeStatus(pr.id));
        });
    }
    createComposite(pr, merge) {
        let composite = new prComposite_1.PrComposite();
        composite.version = pr.version;
        composite.fromBranch = pr.fromRef;
        composite.toBranch = pr.toRef;
        composite.id = pr.id;
        composite.title = pr.title;
        composite.author = pr.author.user.displayName;
        composite.authorEmail = pr.author.user.emailAddress;
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
            }
            else {
                composite.mergeRetries = existingCachedComposite.mergeRetries;
            }
            composite.mergeRequested = existingCachedComposite.mergeRequested;
            composite.lastAutobitActionRequestedBy = existingCachedComposite.lastAutobitActionRequestedBy;
            composite.threadId = existingCachedComposite.threadId;
        }
        return composite;
    }
    setBuildStatus(composite, merge) {
        if (!merge.vetoes) {
            composite.buildStatus = BuildStatus.NotSpecified;
            return;
        }
        const buildVetoMessage = merge.vetoes.find(x => x.summaryMessage === exports.BuildVetoSummaryMessage);
        if (!buildVetoMessage || !buildVetoMessage.detailedMessage) {
            composite.buildStatus = BuildStatus.NotSpecified;
            return;
        }
        if (buildVetoMessage.detailedMessage === BuildStatus.InProgress) {
            composite.buildStatus = BuildStatus.InProgress;
        }
        else if (buildVetoMessage.detailedMessage === BuildStatus.Failed) {
            composite.buildStatus = BuildStatus.Failed;
        }
        else if (buildVetoMessage.detailedMessage === BuildStatus.NeedMinimumOfOne) {
            composite.buildStatus = BuildStatus.NeedMinimumOfOne;
        }
        else {
            composite.buildStatus = BuildStatus.Other;
        }
    }
    static updateCompositeFromActivities(composite, activities) {
        let commentFound = null;
        let originalMergeRequestedStatus = composite.mergeRequested;
        for (let i = 0; i < activities.length - 1; i++) {
            let activity = activities[i];
            if (activity.comment) {
                let text = (activity.comment.text || '').replace('\n', '').trim();
                if (text === 'cancel') {
                    composite.mergeRequested = false;
                    commentFound = activity.comment;
                    break;
                }
                else if (text === 'mab') {
                    composite.mergeRequested = true;
                    commentFound = activity.comment;
                    break;
                }
            }
        }
        if (!commentFound) {
            composite.mergeRequested = false;
        }
        else {
            composite.lastAutobitActionRequestedBy = commentFound.author.displayName;
        }
        if (composite.mergeRequested != originalMergeRequestedStatus) {
            composite.sendMergeRequestNotification = true;
        }
    }
}
exports.BitBucket = BitBucket;
//# sourceMappingURL=bitbucket.js.map