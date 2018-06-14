"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flowdock_1 = require("../src/flowdock");
const ts_mocks_1 = require("ts-mocks");
describe('first', () => {
    let fd;
    beforeEach(() => {
        fd = new flowdock_1.Flowdock('foo', 'bar', 'baz');
        fd.http = new ts_mocks_1.Mock().Object;
    });
});
//# sourceMappingURL=flowdock.spec.js.map