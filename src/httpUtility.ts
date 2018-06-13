import * as ht from 'typed-rest-client/HttpClient';
import * as rm from 'typed-rest-client/RestClient';

export class HttpUtility {
  static validateHttpResponse(response: ht.HttpClientResponse) {
    if (response.message.statusCode !== 200 && response.message.statusCode !== 201) {
      throw `(${response.message.statusCode}) ${response.message.statusMessage}`;
    }
  }
  static validateRestResponse(response: rm.IRestResponse<any>) {
    if (response.statusCode !== 200 && response.statusCode !== 201) {
      throw `(${response.statusCode}) ${response.result}`;
    }
  }
}