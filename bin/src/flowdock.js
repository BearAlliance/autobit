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
const ht = require("typed-rest-client/HttpClient");
const bitbucket_1 = require("./bitbucket");
const httpUtility_1 = require("./httpUtility");
let Session = require('flowdock').Session;
class Field {
}
exports.Field = Field;
class Flowdock {
    constructor(token, username, flowName) {
        this.token = token;
        this.username = username;
        this.flowName = flowName;
        this.http = new ht.HttpClient('autobit');
        this.base64Authorization = 'BASIC ' + new Buffer(token + ':').toString('base64');
    }
    initializeFlowdock() {
        return __awaiter(this, void 0, void 0, function* () {
            this.session = new Session(this.token);
            yield this.getFlowId(this.flowName);
            yield this.getUsers();
        });
    }
    getFlowId(flowName) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.session.flows((err, flows) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        let flow = flows.find(flow => flow.name === flowName);
                        if (!flow) {
                            reject('Flow not found');
                        }
                        this.flowId = flow.id;
                        resolve(flow.id);
                    }
                });
            });
        });
    }
    postChange(composite) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.postContent(this.formatForFlowdock(composite), composite.composite.threadId, composite.composite.authorEmail, composite.composite.notificationEmails);
        });
    }
    postError(error, composite) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.postGeneralMessage('bangbang', error, composite);
        });
    }
    postInfo(info, composite) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.postGeneralMessage('small_blue_diamond', info, composite);
        });
    }
    postGeneralMessage(emoji, msg, composite) {
        return __awaiter(this, void 0, void 0, function* () {
            let callThreadId = yield this.postContent(`:${emoji}: ${msg}`, composite ? composite.threadId : this.generalThreadId, composite ? composite.authorEmail : null, composite ? composite.newCommentsFrom : null);
            composite ? (composite.threadId = callThreadId) : (this.generalThreadId = callThreadId);
        });
    }
    formatForFlowdock(composite) {
        let line1 = `**${composite.changeAsString}** : *${this.createPRNameLink(composite.composite)}* **on ${composite.composite.toBranch.displayId}**`;
        let line2 = `${composite.composite.author} / Created on ${composite.composite.createdDate.toLocaleString()}`;
        let fields = [];
        if (composite.changeType !== bitbucket_1.ChangeType.Deleted) {
            if (composite.composite.approvals > 0) {
                fields.push({ label: 'Approvals', value: composite.composite.approvals });
            }
            if (composite.composite.isConflicted) {
                fields.push({ label: 'Merge conflict', emoji: 'interrobang' });
            }
            if (composite.composite.openTasks) {
                fields.push({ label: 'Open tasks', emoji: 'o', value: composite.composite.openTasks });
            }
            if (composite.composite.needWorks) {
                fields.push({ label: 'Needs work', emoji: 'exclamation' });
            }
            if (composite.oneTimeChangeMessage) {
                fields.push({ label: composite.oneTimeChangeMessage, emoji: 'eight_pointed_black_star' });
            }
            if (composite.composite.canMerge) {
                fields.push({ label: 'Can merge', emoji: 'white_check_mark' });
            }
            ;
            this.createBuildStatusField(composite, fields);
            if (composite.composite.mergeRequested) {
                fields.push({ label: '', emoji: 'part_alternation_mark' });
            }
            if (composite.commentMessage) {
                fields.push({ label: composite.commentMessage, emoji: 'envelope' });
            }
        }
        let line3 = this.createFieldLine(fields);
        return `${line1} \r\n${line2} \r\n${line3}`;
    }
    createBuildStatusField(composite, fields) {
        if (composite.composite.buildStatus !== bitbucket_1.BuildStatus.Successful && composite.composite.buildStatus !== bitbucket_1.BuildStatus.NotSpecified) {
            let msg = null;
            let emoji = '';
            switch (composite.composite.buildStatus) {
                case bitbucket_1.BuildStatus.NeedMinimumOfOne:
                    msg = 'Build not started';
                    emoji = 'wavy_dash';
                    break;
                case bitbucket_1.BuildStatus.Failed:
                    msg = 'Build failed';
                    emoji = 'no_entry';
                    break;
                case bitbucket_1.BuildStatus.InProgress:
                    msg = 'Build in progress';
                    emoji = 'clock1030';
                    break;
            }
            if (msg) {
                fields.push({ label: msg, emoji: emoji });
            }
        }
    }
    createPRNameLink(composite) {
        return `[${composite.title}](${composite.link})`;
    }
    createFieldLine(fields) {
        let line = '';
        if (fields) {
            fields.forEach(field => {
                line += '`';
                if (field.emoji) {
                    line += ':' + field.emoji + ': ';
                }
                line += `${field.label}${field.value ? ': ' + field.value : ''}`;
                line += '` ';
            });
        }
        return line;
    }
    //use our own post content because the flowdock library doesn't support custom content
    postContent(message, threadId, authorEmail, notificationEmails) {
        return __awaiter(this, void 0, void 0, function* () {
            let content = { flow: this.flowId, content: message, external_user_name: "Autobit", event: "message", thread_id: threadId };
            let headers = {
                "Authorization": this.base64Authorization,
                "content-type": "application/json",
                "X-flowdock-wait-for-message": "true"
            };
            if (authorEmail) {
                this.sendMessageToUser(authorEmail, message);
            }
            if (notificationEmails) {
                notificationEmails.forEach(email => this.sendMessageToUser(email, message));
            }
            let response = yield this.http.post(`https://api.flowdock.com/messages`, JSON.stringify(content), headers);
            httpUtility_1.HttpUtility.validateHttpResponse(response);
            let body = JSON.parse(yield response.readBody());
            return body.thread_id;
        });
    }
    getUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            let headers = {
                "Authorization": this.base64Authorization,
                "content-type": "application/json",
                "X-flowdock-wait-for-message": "true"
            };
            let response = yield this.http.get(`https://api.flowdock.com/users`, headers);
            httpUtility_1.HttpUtility.validateHttpResponse(response);
            this.flowDockUsers = JSON.parse(yield response.readBody());
        });
    }
    sendMessageToUser(email, message) {
        return __awaiter(this, void 0, void 0, function* () {
            // email = 'john.west@adp.com';
            // const whitelist = ['john.west@adp.com', 'matthew.warrens@adp.com', 'Ethan.Washbourne@adp.com', 'Matthew.Wilkey@ADP.com', 'ashwin.patha@adp.com']
            // if (whitelist.find(x => x.toUpperCase() === email.toUpperCase()) ) {
            message = message + '\r\n*This message was auto-generated.  Post to the [Autobit users](https://www.flowdock.com/app/adpes/autobit-users) flow if you have questions.*';
            let content = { event: "message", content: message };
            let headers = {
                "Authorization": this.base64Authorization,
                "content-type": "application/json",
                "X-flowdock-wait-for-message": "true"
            };
            const foundUser = this.flowDockUsers.find(x => x.email.toLowerCase() === email.toLowerCase());
            // do nothing if user not found
            if (foundUser) {
                const id = foundUser.id;
                let response = yield this.http.post(`https://api.flowdock.com/private/${id}/messages`, JSON.stringify(content), headers);
                httpUtility_1.HttpUtility.validateHttpResponse(response);
            }
            // }
        });
    }
}
exports.Flowdock = Flowdock;
//# sourceMappingURL=flowdock.js.map