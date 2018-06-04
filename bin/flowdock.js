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
