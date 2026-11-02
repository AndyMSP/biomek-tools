# 15. Builds named by their version

Date: 2026-11-02

## Status
Proposed (Andy, 2026-11-02: decided in a chat; accepted by merging its pull request).

## Context
Every build of a tool was called the same thing, `transfer-designer.html`, so an old build and a new
one looked alike. On 2026-11-02 Andy sent his manager a build that wasn't the latest. The version
in `package.json` didn't help either: it changes only at a release, so every build since v0.1.0
said 0.1.0.

## Decision
**Each build is named by its version, worked out from git, following Semantic Versioning**
(semver.org; Andy, 2026-11-02, asking for the industry's way):
- **A release** is built at its tag, and named by its version alone: `transfer-designer-v0.2.0.html`.
- **A build between releases** is a **pre-release** of the version being worked towards, numbered by
  the commits since the last release: `transfer-designer-v0.2.0-dev.488.html` from `main`. SemVer
  orders it after 0.1.0 and before 0.2.0, and a higher number is a later build.
- **A build from another branch** has the branch's name in place of `dev`
  (`v0.2.0-moving-stages.488`), as GitVersion and similar tools do, so it can't share a name with a
  build of `main` holding different code (Andy, 2026-11-02).
- **A build with changes not committed** ends `.dirty`, Git's own word for it.
- **The commit** is build metadata (`+3cc65a9`): not in the file name, where a `+` is awkward in
  links, but **shown in the page**, at the bottom right, and recorded in saved plan files, so a
  build can always be traced to its code (Andy, 2026-11-02, from a preview).
- **`package.json` holds the version being worked towards**: 0.2.0 now, and, straight after each
  release, the next planned version. The build stops if it doesn't (`scripts/build-version.md`).

The commit count alone was considered for the file name (Git's own `v0.1.0-488-g3cc65a9` form) and
set aside: SemVer reads `0.1.0-488` as earlier than 0.1.0, and a count alone can't tell a branch's
build from `main`'s.

## Consequences
- The file sent around always says which build it is, and the lab's releases keep a plain name.
- `npm run build` clears earlier builds of the tools from `dist/`, so only the newest is there to
  send.
- A release needs its tag before it's built; the README's release steps change to say so, and gain
  a last step: set `package.json` to the next planned version.
- Building needs a git clone with its tags (`git fetch --tags`); a downloaded zip can't be built.
