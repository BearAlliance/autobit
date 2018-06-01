#!/usr/bin/env node
import { BitBucket } from './bitbucket';
import { Prs } from './types/prs';
import { Flowdock } from './flowdock';
let prompt = require('password-prompt');

const optionDefinitions = [
  { name: 'username', alias: 'u', type: String },
  { name: 'branch', alias: 'b', type: String },
  { name: 'flowdockToken', alias: 'f', type: String },
  { name: 'bitbucketBaseUrl', alias: 'l', type: String },
  { name: 'proxyBypass', alias: 'y', type: String },
  { name: 'proxyUrl', alias: 'x', type: String, defaultValue: '' },
  { name: 'intervalSeconds', type: Number, defaultValue: 60 }
]

const commandLineArgs = require('command-line-args');
const options = commandLineArgs(optionDefinitions);

Promise.resolve(options.username || prompt('Enter your username: ')).then((username) => {
  prompt('Enter your password: ', { method: 'hide' }).then((password) => {
    let fd = new Flowdock(options.flowdockToken);
    let bb = new BitBucket(username, password, options.branch, options.bitbucketBaseUrl, options.proxyBypass, options.proxyUrl, fd);

    fd.postInfo('Autobit started');

    bb.loop();
    setInterval(() => bb.loop(), options.intervalSeconds * 1000);
  }).catch((err) => {
    console.log(err);
  });

});
