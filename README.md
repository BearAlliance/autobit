# autobit

This is an app to poll a bitbucket branch for PRs.  When the PRs are found, it looks for changes from the last poll.  If there are changes, it will create a message in a Flowdock flow.  If the PR is ready to merge and someone has left the comment "mab", the PR will be merged.

## Why autobit?

We were having issues with being ready to merge a PR, but having to remember to come back to it if a build was in progress.  Our builds can take 10s of minutes, and often PRs would linger until they were caught at just the right time when builds were complete (builds get spawned for every merge, so there are lots of builds going on).  By having a process that polls the PRs looking for the comment "mab", we can let autobit merge when the PR is ready.

Also, we were getting lots of bitbucket emails, and some of us stopped looking at them.  Now we can have major PR changes logged to a flow, which is where many people live these days.

## Parameters

- username - you have to log in with your credentials to authenticate against bitbucket.  you can pass your username here
- password - bitbucket password - if not specified you'll be prompted
- branch - the branch you want to poll (ex. refs/heads/foo/bar) - can be multiple branches (ex. refs/heads/foo/bar refs/heads/bam/baz)
- flowdockToken - the api token to use to authenticate to flowdock
- bitbucketBaseUrl - the base url to your bitbucket instance (ex. https://bitbucket.foo.com/rest/api/1.0)
- proxyBypass - addresses you don't want going through whatever proxy you have (i have a no_proxy export, but it doesn't seem to get honored by the library i'm using) (ex. foo.com)
- proxyUrl - the url to your proxy, if any
- flowName - the name of the flow to post to (ex. 'Myflow for automation')
- repository - the repository part of the path, (ex. projects/foo/repos/bar)
- intervalSeconds - the number of seconds between polling (defaults to 10)
- flowdockUsername - the name displayed for flowdock automation messages (defaults to autobit)

## Installation

Install autobit with ```npm i -g autobit```

## Usage

Run autobit from the terminal, ex. ```autobit -u myusername -b refs/heads/foo/bar -f 2asdfasff232234234234 --bitbucketBaseUrl https://bitbucket.foo.com -flowName 'My automation' -repository projects/foo/repos/bar```

## Notes

- If autobit fails due to a 401, authentication failed, the process will exit and an error will be logged to flowdock.  This should only happen if your credentials are no longer valid, in which case you'll have to start the process again to enter your password.

- "mab" is the comment used to tell autobit you want the PR merged as soon as it's able to be merged
- "cancel" is a comment you can put after a "mab" to tell autobit to ignore the previous "mab"