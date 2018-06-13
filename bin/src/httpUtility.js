"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class HttpUtility {
    static validateHttpResponse(response) {
        if (response.message.statusCode !== 200 && response.message.statusCode !== 201) {
            throw `(${response.message.statusCode}) ${response.message.statusMessage}`;
        }
    }
    static validateRestResponse(response) {
        if (response.statusCode !== 200 && response.statusCode !== 201) {
            throw `(${response.statusCode}) ${response.result}`;
        }
    }
}
exports.HttpUtility = HttpUtility;
//# sourceMappingURL=httpUtility.js.map