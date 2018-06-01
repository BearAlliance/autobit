import * as ht from 'typed-rest-client/HttpClient';

export class HttpUtility {
  static validatePostResponse(response: ht.HttpClientResponse) {
    if (response.message.statusCode !== 200 && response.message.statusCode !== 201) {
      console.log(response.message);
      throw `(${response.message.statusCode}) ${response.message.statusMessage}`;
    }
  }
}