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
var ChangeType;
(function (ChangeType) {
    ChangeType[ChangeType["Added"] = 0] = "Added";
    ChangeType[ChangeType["Changed"] = 1] = "Changed";
    ChangeType[ChangeType["Deleted"] = 2] = "Deleted";
})(ChangeType = exports.ChangeType || (exports.ChangeType = {}));
class ChangeComposite {
}
exports.ChangeComposite = ChangeComposite;
const postHeaders = {
    "content-type": "application/json"
};
class BitBucket {
    constructor(username, password, branch, baseUrl, proxyBypass, proxyUrl, flowdock) {
        this.username = username;
        this.password = password;
        this.branch = branch;
        this.baseUrl = baseUrl;
        this.proxyBypass = proxyBypass;
        this.proxyUrl = proxyUrl;
        this.flowdock = flowdock;
        this.cachedComposites = [];
        this.loopExecuting = false;
        this.basicHandler = new hm.BasicCredentialHandler(username, password);
        this.http = new ht.HttpClient('autobit', [this.basicHandler], { proxy: { proxyBypassHosts: [this.proxyBypass], proxyUrl: this.proxyUrl } });
        this.rest = new rm.RestClient('autobit', baseUrl, [this.basicHandler], { proxy: { proxyBypassHosts: [this.proxyBypass], proxyUrl: this.proxyUrl } });
    }
    getPrs() {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.rest.get('/dashboard/pull-requests?state=OPEN');
            return response.result;
        });
    }
    getActivities(id) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.rest.get(`/projects/RED/repos/redbox-spa/pull-requests/${id}/activities?fromType=comment`);
            return response.result;
        });
    }
    getMergeStatus(id) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.rest.get(`/projects/RED/repos/redbox-spa/pull-requests/${id}/merge`);
            return response.result;
        });
    }
    getFilteredPrs() {
        return __awaiter(this, void 0, void 0, function* () {
            let prs = yield this.getPrs();
            return prs.values.filter((pr) => pr.toRef.id === this.branch);
        });
    }
    getAllComposites() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getFilteredPrs().then(prs => Promise.all(prs.map((pr) => __awaiter(this, void 0, void 0, function* () { return yield this.getCompositeWithMergeStatus(pr); }))));
        });
    }
    mergePr(id, version) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.http.post(`${this.baseUrl}/projects/RED/repos/redbox-spa/pull-requests/${id}/merge?version=${version}`, '', postHeaders);
            httpUtility_1.HttpUtility.validatePostResponse(response);
        });
    }
    postComment(id, comment) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.http.post(`${this.baseUrl}/projects/RED/repos/redbox-spa/pull-requests/${id}/comments`, JSON.stringify({ text: comment }), postHeaders);
            httpUtility_1.HttpUtility.validatePostResponse(response);
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
            else if (composite.mergeRequested !== existingCachedComposite.mergeRequested ||
                composite.title !== existingCachedComposite.title ||
                composite.approvals !== existingCachedComposite.approvals ||
                composite.needWorks !== existingCachedComposite.needWorks ||
                composite.openTasks !== existingCachedComposite.openTasks ||
                composite.canMerge !== existingCachedComposite.canMerge ||
                composite.isConflicted !== existingCachedComposite.isConflicted) {
                changes.push({ composite, changeType: ChangeType.Changed, changeAsString: ChangeType[ChangeType.Changed] });
                this.cachedComposites.splice(this.cachedComposites.indexOf(existingCachedComposite), 1);
                this.cachedComposites.push(composite);
            }
            ;
        });
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
                try {
                    console.log('Processing...');
                    this.loopExecuting = true;
                    let composites = yield this.getAllComposites();
                    for (let composite of composites) {
                        if (composite.canMerge) {
                            let activities = yield this.getActivities(composite.id);
                            BitBucket.updateCompositeFromActivities(composite, activities.values);
                            if (composite.mergeRequested) {
                                let requestMessage = `Automerge requested for ${composite.title}`;
                                let completedMessage = `Automerge completed for ${composite.title}`;
                                yield this.flowdock.postInfo(requestMessage);
                                yield this.postComment(composite.id, requestMessage);
                                yield this.mergePr(composite.id, composite.version);
                                yield this.postComment(composite.id, completedMessage);
                                yield this.flowdock.postInfo(completedMessage);
                            }
                        }
                    }
                    ;
                    let changes = this.updateCacheAndReturnDiffs(composites);
                    changes.forEach((change) => __awaiter(this, void 0, void 0, function* () { return yield this.flowdock.postChange(change); }));
                    console.log(changes);
                }
                catch (ex) {
                    console.log('ERROR', ex);
                    if (ex.statusCode == '401') {
                        yield this.flowdock.postError('Autobit stopped with ERROR ' + ex.statusCode);
                        process.exit(ex.statusCode);
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
            return BitBucket.createComposite(pr, yield this.getMergeStatus(pr.id));
        });
    }
    static createComposite(pr, merge) {
        let composite = new prComposite_1.PrComposite();
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
        return composite;
    }
    static updateCompositeFromActivities(composite, activities) {
        composite.mergeRequested = false;
        for (let i = 0; i < activities.length - 1; i++) {
            let activity = activities[i];
            if (activity.comment) {
                if (activity.comment.text === 'cancel') {
                    break;
                }
                else if (activity.comment.text === 'mab') {
                    composite.mergeRequested = true;
                    break;
                }
            }
        }
    }
}
exports.BitBucket = BitBucket;
