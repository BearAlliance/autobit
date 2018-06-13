"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flowdock_1 = require("../src/flowdock");
describe('first', () => {
    it('should create instance', () => {
        let fd = new flowdock_1.Flowdock('foo', 'bar', 'baz');
        expect(fd).toBeDefined();
    });
});
//# sourceMappingURL=flowdock.spec.js.map