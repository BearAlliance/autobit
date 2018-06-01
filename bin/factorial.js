"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Factorial {
    constructor(num) {
        this.num = num;
    }
    getFactorial() {
        return this.doFact(this.num);
    }
    doFact(num) {
        return num <= 1 ? 1 : num * this.doFact(num - 1);
    }
}
exports.Factorial = Factorial;
