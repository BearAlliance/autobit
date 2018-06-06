#!/usr/bin/env node
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
define("types/prs", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("types/activities", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
});
define("types/merge", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class MergeStatus {
    }
    exports.MergeStatus = MergeStatus;
});
define("httpUtility", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class HttpUtility {
        static validatePostResponse(response) {
            if (response.message.statusCode !== 200 && response.message.statusCode !== 201) {
                console.log(response.message);
                throw `(${response.message.statusCode}) ${response.message.statusMessage}`;
            }
        }
    }
    exports.HttpUtility = HttpUtility;
});
define("types/prComposite", ["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class PrComposite {
        constructor() {
            this.mergeRequested = false;
        }
    }
    exports.PrComposite = PrComposite;
});
define("flowdock", ["require", "exports", "typed-rest-client/HttpClient", "bitbucket", "httpUtility"], function (require, exports, ht, bitbucket_1, httpUtility_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Flowdock {
        constructor(token) {
            this.http = new ht.HttpClient('autobit');
            this.token = token;
        }
        postChange(composite) {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.postContent(this.formatForFlowdock(composite));
            });
        }
        postError(error) {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.postContent(':bangbang: ' + error);
            });
        }
        postInfo(info) {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.postContent(':small_blue_diamond: ' + info);
            });
        }
        formatForFlowdock(composite) {
            let line1 = `**${composite.changeAsString}** : *${composite.composite.title}*`;
            let line2 = `${composite.composite.author} / ${composite.composite.createdDate.toDateString()}`;
            let line3 = composite.changeType === bitbucket_1.ChangeType.Deleted ? '' : `\`Approvals: ${composite.composite.approvals}\` ${composite.composite.isConflicted ? `\`:interrobang: Merge conflict\`` : ''} ${composite.composite.openTasks ? `\`:o: Open Tasks: ${composite.composite.openTasks}\`` : ''} ${composite.composite.needWorks ? `\`:exclamation: Needs work\`` : ''} ${!composite.composite.needWorks && composite.composite.canMerge ? `\`:white_check_mark: Merge\`` : ''}`;
            let line4 = `[PR](${composite.composite.link})`;
            return `${line1}\r\n${line2}\r\n${line3}\r\n${line4}`;
        }
        postContent(message) {
            return __awaiter(this, void 0, void 0, function* () {
                let content = { content: message, external_user_name: "Autobit" };
                let headers = {
                    "content-type": "application/json"
                };
                let response = yield this.http.post(`https://api.flowdock.com/v1/messages/chat/${this.token}`, JSON.stringify(content), headers);
                httpUtility_1.HttpUtility.validatePostResponse(response);
            });
        }
    }
    exports.Flowdock = Flowdock;
});
define("bitbucket", ["require", "exports", "typed-rest-client/RestClient", "typed-rest-client/Handlers", "typed-rest-client/HttpClient", "httpUtility", "types/prComposite"], function (require, exports, rm, hm, ht, httpUtility_2, prComposite_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
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
                httpUtility_2.HttpUtility.validatePostResponse(response);
            });
        }
        postComment(id, comment) {
            return __awaiter(this, void 0, void 0, function* () {
                let response = yield this.http.post(`${this.baseUrl}/projects/RED/repos/redbox-spa/pull-requests/${id}/comments`, JSON.stringify({ text: comment }), postHeaders);
                httpUtility_2.HttpUtility.validatePostResponse(response);
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
});
define("main", ["require", "exports", "bitbucket", "flowdock"], function (require, exports, bitbucket_2, flowdock_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    let prompt = require('password-prompt');
    const optionDefinitions = [
        { name: 'username', alias: 'u', type: String },
        { name: 'branch', alias: 'b', type: String },
        { name: 'flowdockToken', alias: 'f', type: String },
        { name: 'bitbucketBaseUrl', alias: 'l', type: String },
        { name: 'proxyBypass', alias: 'y', type: String },
        { name: 'proxyUrl', alias: 'x', type: String, defaultValue: '' },
        { name: 'intervalSeconds', type: Number, defaultValue: 60 }
    ];
    const commandLineArgs = require('command-line-args');
    const options = commandLineArgs(optionDefinitions);
    Promise.resolve(options.username || prompt('Enter your username: ')).then((username) => {
        prompt('Enter your password: ', { method: 'hide' }).then((password) => {
            let fd = new flowdock_1.Flowdock(options.flowdockToken);
            let bb = new bitbucket_2.BitBucket(username, password, options.branch, options.bitbucketBaseUrl, options.proxyBypass, options.proxyUrl, fd);
            try {
                fd.postInfo('Autobit started');
            }
            catch (ex) {
                console.log('First flowdock failed', ex);
            }
            bb.loop();
            setInterval(() => bb.loop(), options.intervalSeconds * 1000);
        }).catch((err) => {
            console.log(err);
        });
    });
});
//# sourceMappingURL=main.js.map