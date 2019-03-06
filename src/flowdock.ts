import * as rm from 'typed-rest-client/RestClient';
import * as ht from 'typed-rest-client/HttpClient';
import * as hm from 'typed-rest-client/Handlers';
import * as ifm from 'typed-rest-client/Interfaces';
import { PrComposite } from "./types/prComposite";
import { ChangeComposite, ChangeType, BuildStatus } from './bitbucket';
import { HttpUtility } from './httpUtility';
import { flowDockUser } from './types/flowDockUser';

let Session = require('flowdock').Session;

export class Field {
  label: string;
  value?: any;
  emoji?: string;
}
export class Flowdock {
  basicHandler: hm.BasicCredentialHandler;
  http: ht.HttpClient;

  session: any;
  generalThreadId: string;

  base64Authorization: string;
  flowId: string;

  flowDockUsers: flowDockUser[];

  constructor(private token: string, private username: string, private flowName: string, private blacklist: string[]) {
    this.http = new ht.HttpClient('autobit');
    this.base64Authorization = 'BASIC ' + new Buffer(token + ':').toString('base64');
  }

  async initializeFlowdock() {
    this.session = new Session(this.token);
    await this.getFlowId(this.flowName);
    await this.getUsers();
  }

  async getFlowId(flowName: string) {
    return new Promise((resolve, reject) => {
      this.session.flows((err, flows) => {
        if (err) {
          reject(err);
        } else {
          let flow = flows.find(flow => flow.name === flowName);
          if (!flow) {
            reject('Flow not found');
          }
          this.flowId = flow.id;
          resolve(flow.id);
        }
      });
    });
  }

  async postChange(composite: ChangeComposite) {
    return await this.postContent(this.formatForFlowdock(composite), composite.composite.threadId,
      composite.composite.authorEmail, composite.composite.notificationEmails);
  }

  async postError(error: string, composite?: PrComposite) {
    await this.postGeneralMessage('bangbang', error, composite);
  }

  async postInfo(info: string, composite?: PrComposite) {
    await this.postGeneralMessage('small_blue_diamond', info, composite);
  }

  async postGeneralMessage(emoji: string, msg: string, composite: PrComposite) {
    let callThreadId = await this.postContent(`:${emoji}: ${msg}`,
    composite ? composite.threadId : this.generalThreadId,
    composite ? composite.authorEmail : null,
    composite ? composite.newCommentsFrom : null);
    composite ? (composite.threadId = callThreadId) : (this.generalThreadId = callThreadId);
  }

  formatForFlowdock(composite: ChangeComposite) {
    let line1 = `**${composite.changeAsString}** : *${this.createPRNameLink(composite.composite)}* **on ${composite.composite.toBranch.displayId}**`;
    let line2 = `${composite.composite.author} / Created on ${composite.composite.createdDate.toLocaleString()}`;

    let fields: Field[] = [];
    if (composite.changeType !== ChangeType.Deleted) {
      if (composite.composite.approvals > 0) {
        fields.push({ label: 'Approvals', value: composite.composite.approvals });
      }
      if (composite.composite.isConflicted) { fields.push({ label: 'Merge conflict', emoji: 'interrobang' }) }
      if (composite.composite.openTasks) { fields.push({ label: 'Open tasks', emoji: 'o', value: composite.composite.openTasks }) }
      if (composite.composite.needWorks) {
        fields.push({ label: 'Needs work', emoji: 'exclamation' })
      }
      if (composite.oneTimeChangeMessage) {
        fields.push({ label: composite.oneTimeChangeMessage, emoji: 'eight_pointed_black_star' })
      }
      if (composite.composite.canMerge) { fields.push({ label: 'Can merge', emoji: 'white_check_mark' }) };
      this.createBuildStatusField(composite, fields);
      if (composite.composite.mergeRequested) {
        fields.push({ label: '', emoji: 'part_alternation_mark' })
      }
      if (composite.commentMessage) {
        fields.push({ label: composite.commentMessage, emoji: 'envelope' })
      }
    }
    let line3 = this.createFieldLine(fields);
    return `${line1} \r\n${line2} \r\n${line3}`;
  }

  createBuildStatusField(composite: ChangeComposite, fields: Field[]) {
    if (composite.composite.buildStatus !== BuildStatus.Successful && composite.composite.buildStatus !== BuildStatus.NotSpecified) {
      let msg = null;
      let emoji = '';
      switch (composite.composite.buildStatus) {
        case BuildStatus.NeedMinimumOfOne:
          msg = 'Build not started';
          emoji = 'wavy_dash';
          break;
        case BuildStatus.Failed:
          msg = 'Build failed';
          emoji = 'no_entry';
          break;
        case BuildStatus.InProgress:
          msg = 'Build in progress';
          emoji = 'clock1030';
          break;
      }
      if (msg) {
        fields.push({ label: msg, emoji: emoji })
      }
    }
  }

  createPRNameLink(composite: PrComposite) {
    return `[${composite.title}](${composite.link})`;
  }
  createFieldLine(fields: Field[]) {
    let line = '';
    if (fields) {
      fields.forEach(field => {
        line += '`';
        if (field.emoji) {
          line += ':' + field.emoji + ': '
        }
        line += `${field.label}${field.value ? ': ' + field.value : ''}`;
        line += '` ';
      });
    }
    return line;
  }

  //use our own post content because the flowdock library doesn't support custom content
  private async postContent(message: string, threadId: string, authorEmail: string, notificationEmails: string[]): Promise<string> {
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

    let response = await this.http.post(`https://api.flowdock.com/messages`, JSON.stringify(content), headers);
    HttpUtility.validateHttpResponse(response);
    let body = JSON.parse(await response.readBody());
    return body.thread_id;
  }

  private async getUsers() {
    let headers = {
      "Authorization": this.base64Authorization,
      "content-type": "application/json",
      "X-flowdock-wait-for-message": "true"
    };

    let response = await this.http.get(`https://api.flowdock.com/users`, headers);
    HttpUtility.validateHttpResponse(response);
    this.flowDockUsers = JSON.parse(await response.readBody());
  }

  private async sendMessageToUser(email: string, message: string) {
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
    const userOnBlacklist = this.blacklist.some(user => user === email);

    // do nothing if user not found, or user is on blacklist
    if (foundUser && !userOnBlacklist) {
      const id = foundUser.id;
      let response = await this.http.post(`https://api.flowdock.com/private/${id}/messages`, JSON.stringify(content), headers);
      HttpUtility.validateHttpResponse(response);
    }
    // }
  }
}
