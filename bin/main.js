#!/usr/bin/env node
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
const bitbucket_1 = require("./bitbucket");
const flowdock_1 = require("./flowdock");
let prompt = require('password-prompt');
const optionDefinitions = [
    { name: 'username', alias: 'u', type: String },
    { name: 'branch', alias: 'b', type: String },
    { name: 'flowdockToken', alias: 'f', type: String },
    { name: 'bitbucketBaseUrl', alias: 'l', type: String },
    { name: 'proxyBypass', alias: 'y', type: String },
    { name: 'proxyUrl', alias: 'x', type: String, defaultValue: '' },
    { name: 'intervalSeconds', type: Number, defaultValue: 10 },
    { name: 'flowdockUsername', type: String, defaultValue: 'autobit' }
];
const commandLineArgs = require('command-line-args');
const options = commandLineArgs(optionDefinitions);
class Main {
    start() {
        Promise.resolve(options.username || prompt('Enter your username: ')).then((username) => {
            prompt('Enter your password: ', { method: 'hide' }).then((password) => {
                let fd = new flowdock_1.Flowdock(options.flowdockToken, options.flowdockUsername);
                fd.initializeFlowdock().then(() => __awaiter(this, void 0, void 0, function* () {
                    let bb = new bitbucket_1.BitBucket(username, password, options.branch, options.bitbucketBaseUrl, options.proxyBypass, options.proxyUrl, fd);
                    console.log('hello');
                    try {
                        yield fd.postInfo('Autobit started');
                        yield fd.postInfo('Bitbucket branch ' + options.branch);
                    }
                    catch (ex) {
                        console.log('First flowdock failed', ex);
                    }
                    bb.loop();
                    setInterval(() => bb.loop(), options.intervalSeconds * 1000);
                })).catch((err) => {
                    console.log(err);
                });
            });
        });
    }
}
let main = new Main();
main.start();
//# sourceMappingURL=main.js.map