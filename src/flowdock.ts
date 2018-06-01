import * as rm from 'typed-rest-client/RestClient';
import * as ht from 'typed-rest-client/HttpClient';
import * as hm from 'typed-rest-client/Handlers';
import * as ifm from 'typed-rest-client/Interfaces';
import { PrComposite } from "./types/prComposite";
import { ChangeComposite, ChangeType } from './bitbucket';
import { HttpUtility } from './httpUtility';

export class Flowdock {
  basicHandler: hm.BasicCredentialHandler;
  http: ht.HttpClient;

  token: string;

  constructor(token: string) {
    this.http = new ht.HttpClient('autobit');
    this.token = token;
  }

  async postChange(composite: ChangeComposite) {
    await this.postContent(this.formatForFlowdock(composite));
  }

  async postError(error: string) {
    await this.postContent(':bangbang: ' + error);
  }

  async postInfo(info: string) {
    await this.postContent(':small_blue_diamond: ' + info);
  }

  formatForFlowdock(composite: ChangeComposite) {
    let line1 = `**${composite.changeAsString}** : *${composite.composite.title}*`;
    let line2 = `${composite.composite.author} / ${composite.composite.createdDate.toDateString()}`;
    let line3 = composite.changeType === ChangeType.Deleted ? '' : `\`Approvals: ${composite.composite.approvals}\` ${composite.composite.isConflicted ? `\`:interrobang: Merge conflict\`` : ''} ${composite.composite.openTasks ? `\`:o: Open Tasks: ${composite.composite.openTasks}\`` : ''} ${composite.composite.needWorks ? `\`:exclamation: Needs work\`` : ''} ${!composite.composite.needWorks && composite.composite.canMerge ? `\`:white_check_mark: Merge\`` : ''}`;
    return `${line1}\r\n${line2}\r\n${line3}`;
  }

  private async postContent(message: string) {
    let content = { content: message, external_user_name: "Autobit" };
    let headers = {
      "content-type": "application/json"
    };

    let response = await this.http.post(`https://api.flowdock.com/v1/messages/chat/${this.token}`, JSON.stringify(content), headers);
    console.log(response);
    console.log(response.message);
    HttpUtility.validatePostResponse(response);
  }    
}