"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class HttpUtility {
    static validatePostResponse(response) {
        if (response.message.statusCode !== 200 && response.message.statusCode !== 201) {
            throw `(${response.message.statusCode}) ${response.message.statusMessage}`;
        }
    }
}
exports.HttpUtility = HttpUtility;
//# sourceMappingURL=httpUtility.js.map