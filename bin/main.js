#!/usr/bin/env node
"use strict";
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
    { name: 'intervalSeconds', type: Number, defaultValue: 60 }
];
const commandLineArgs = require('command-line-args');
const options = commandLineArgs(optionDefinitions);
Promise.resolve(options.username || prompt('Enter your username: ')).then((username) => {
    prompt('Enter your password: ', { method: 'hide' }).then((password) => {
        let fd = new flowdock_1.Flowdock(options.flowdockToken);
        let bb = new bitbucket_1.BitBucket(username, password, options.branch, options.bitbucketBaseUrl, options.proxyBypass, options.proxyUrl, fd);
        try {
            fd.postInfo('Autobit started');
        }
        catch (ex) {
            console.log('First flowdock failed', ex);
        }
        bb.loop();
        setInterval(() => bb.loop(), options.intervalSeconds * 1000);
    }).catch((err) => {
        console.log(err);
    });
});
//# sourceMappingURL=main.js.map