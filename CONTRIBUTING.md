# Contributing to Wibson

_In open source, we feel strongly that to really do something well, you have to get a lot of people involved._—Linus Torvalds

We really appreciate and value contributions to Wibson. Please review the items listed below to make sure that your contributions are merged as soon as possible.

## Reporting Security Vulnerabilities
If you think that you have found a security issue in BatchPayments, please **DO NOT** post it as a Github issue and don't publish it publicly. Instead, all security issues must be sent to developers@wibson.org.
We appreciate your discretion and will give the corresponding credit to the reporter(s).

## Common Contribution Process
In the spirit of openness, this project follows [the Gitflow model].  We use Pull Requests to develop conversations around ideas, and turn ideas into actions.

**Some PR Basics**
- Anyone can submit a Pull Request with changes they'd like to see made.
- Pull Requests should attempt to solve a single [1], clearly defined problem [2].
- Everyone should submit Pull Requests early (within the first few commits), so everyone on the team is aware of the direction you're taking.
- Authors are responsible for explicitly tagging anyone who might be impacted by the pull request and get the recipient's sign-off [3].
- The Pull Request should serve as the authority on the status of a change, so everyone on the team is aware of the plan of action.
- Relevant domain authority _must_ sign-off on a pull request before it is merged [4].
- Anyone _except_ the author can merge a pull request once all sign-offs are complete and all status checks have passed.
- Pull Requests must be submitted against the `develop` branch.

[1]: if there are multiple problems you're solving, it is recommended that you create a branch for each.  For example, if you are implementing a small change and realize you want to refactor an entire function, you might want to implement the refactor as your first branch (and pull request), then create a new branch (and pull request) from the refactor to implement your new _feature_.  This helps resolve merge conflicts and separates out the logical components of the decision-making process.  
[2]: include a description of the problem that is being resolved in the description field, or a reference to the issue number where the problem is reported.  Examples include; "Follow Button doesn't Reflect State of Follow" or "Copy on Front-page is Converting Poorly".
[3]: notably, document the outcome of any out-of-band conversations in the pull request.  
[4]: changes to marketing copy, for example, must be approved by the authority on marketing.

## Coding Style
We follow the rules described in the [.solhint.json] file for the smart contracts code and `standardjs` as described in [package.json] file for tests and any other JS code.

Please, make sure running `npm run lint` finishes successfully.

## Code of Conduct
To ensure an inclusive community, contributors and users in the Wibson community should follow the [Code of Conduct].

## License
By contributing, you agree that your contributions will be licensed under the [LGPL-3.0] License.

## All set!
If you have any questions, feel free to post them to the [Github Issues].

Finally, if you're looking to collaborate and want to find easy tasks to start, look at the issues we marked as ["Good first issue"](https://github.com/wibsonorg/BatchPayments/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22).

Thanks for your time and code. Happy coding!

[the Gitflow model]: http://nvie.com/posts/a-successful-git-branching-model/
[.solhint.json]: .solhint.json
[package.json]: package.json
[Code of Conduct]: CODE_OF_CONDUCT.md
[LGPL-3.0]: LICENSE
[Github Issues]: https://github.com/wibsonorg/BatchPayments/issues
