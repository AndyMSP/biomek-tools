// build-version.js — works out the version of a build from facts about the git repository, so each
// built file's name, and the page inside it, says exactly which build it is (ADR 0015).
// The versions follow Semantic Versioning 2.0.0 (semver.org): a release is MAJOR.MINOR.PATCH, a build
// between releases is a pre-release of the version being worked towards, and the commit is build
// metadata after a "+".
// buildVersion, branchLabel and fileNameFor are pure; readGitFacts runs git.
// Specification: build-version.md.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The label of a build made on main (build-version.md, section 3).
const MAIN_BRANCH = "main";
const MAIN_LABEL = "dev";

// The label of a build made with no branch checked out (a detached HEAD).
const DETACHED_LABEL = "detached";

// Git's own word for changes not committed yet, added to the version of a modified build.
const DIRTY = "dirty";

// What a branch's label starts with when its name alone could be mistaken for main's label, for a
// detached build's, or for a number.
const BRANCH_PREFIX = "branch-";

// MAJOR.MINOR.PATCH: three whole numbers without leading zeros, and nothing after them.
const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

// A release tag, as git describe looks for it: "v" and MAJOR.MINOR.PATCH, e.g. v0.1.0. The glob
// would also take v0.2.0-rc1 or v0.2.0+x, so tags holding "-" or "+" are excluded.
const RELEASE_TAG_PATTERN = "v[0-9]*.[0-9]*.[0-9]*";
const NOT_RELEASE_TAG_PATTERNS = ["*-*", "*+*"];

// The message when the folder isn't a git clone, or git can't be run (section 5).
const NOT_A_CLONE =
  "Can't work out the build's version: this folder isn't a git clone of the repository " +
  "(or git isn't installed). Build from a clone.";

// The version of a build, { short, full }, from the facts about the repository (section 3).
// Throws the checks' messages (section 5) when the version can't be worked out.
// e.g. buildVersion({ packageVersion: "0.2.0", lastRelease: "0.1.0", commitsSince: 488,
//   commit: "3cc65a9", branch: "main", modified: false })
//   → { short: "0.2.0-dev.488", full: "0.2.0-dev.488+3cc65a9" }
export function buildVersion(facts) {
  checkFacts(facts);
  const short = isRelease(facts)
    ? facts.packageVersion
    : `${facts.packageVersion}-${labelFor(facts.branch)}.${facts.commitsSince}${dirtySuffix(facts)}`;
  return { short, full: `${short}+${facts.commit}` };
}

// The label for a branch name, fit for a SemVer pre-release identifier (section 3),
// e.g. branchLabel("fix/Mix steps") → "fix-Mix-steps", branchLabel("dev") → "branch-dev".
export function branchLabel(branch) {
  const label = branch.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const mistakable = label === "" || /^\d+$/.test(label) || label === MAIN_LABEL || label === DETACHED_LABEL;
  return mistakable ? `${BRANCH_PREFIX}${label}` : label;
}

// The built file's name for a tool and a version from buildVersion,
// e.g. fileNameFor("randomizer", { short: "0.2.0", full: "0.2.0+3cc65a9" }) → "randomizer-v0.2.0.html".
export function fileNameFor(tool, version) {
  return `${tool}-v${version.short}.html`;
}

// The facts about the repository in projectFolder (section 3): read with git, and from its
// package.json. Throws section 5's message when the folder isn't a git clone or git can't be run.
// e.g. readGitFacts(".") → { packageVersion: "0.2.0", lastRelease: "0.1.0", commitsSince: 488,
//   commit: "3cc65a9", branch: "build-version", modified: false }
export function readGitFacts(projectFolder) {
  // Runs git in projectFolder, e.g. git("rev-parse", "HEAD") → the commit's full hash.
  const git = (...args) => runGit(projectFolder, args);
  checkIsClone(git);
  const lastRelease = readLastRelease(git);
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  return {
    packageVersion: readPackageVersion(projectFolder),
    lastRelease,
    commitsSince: lastRelease === null ? null : Number(git("rev-list", "--count", `v${lastRelease}..HEAD`)),
    commit: git("rev-parse", "--short=7", "HEAD"),
    branch: branch === "HEAD" ? null : branch,
    modified: git("status", "--porcelain") !== "",
  };
}

// --- Checks ---

// Throws the message of the first check that refuses the facts, in section 3's order.
function checkFacts(facts) {
  const { packageVersion, lastRelease } = facts;
  if (typeof packageVersion !== "string" || !RELEASE_VERSION.test(packageVersion)) {
    throw new Error(
      `package.json's version must be MAJOR.MINOR.PATCH, like 0.2.0, but it's "${String(packageVersion)}".`,
    );
  }
  if (lastRelease === null) {
    throw new Error(
      "No release tag (like v0.1.0) was found. Fetch the tags: git fetch --tags " +
        "(a clone without history may also need --unshallow)",
    );
  }
  if (isAtReleaseTag(facts)) {
    checkAtReleaseTag(facts);
  } else if (compareReleases(packageVersion, lastRelease) <= 0) {
    throw new Error(
      `package.json says ${packageVersion}, but ${lastRelease} has been released. ` +
        `Set the next version first: npm version ${nextMinor(lastRelease)} --no-git-tag-version`,
    );
  }
}

// Throws when a build at a release tag would be neither that release nor a later build
// (checks 3 and 4).
function checkAtReleaseTag({ packageVersion, lastRelease, modified }) {
  if (packageVersion !== lastRelease) {
    throw new Error(
      `This commit is release v${lastRelease}, but package.json says ${packageVersion}. ` +
        `Build the release from a commit whose package.json says ${lastRelease}.`,
    );
  }
  if (modified) {
    throw new Error(
      `This commit is release v${lastRelease}, but it has changes not committed yet. ` +
        "Commit or discard them, or build from a later commit.",
    );
  }
}

// --- Working out the version ---

// True if the commit is the nearest release tag's own commit.
function isAtReleaseTag(facts) {
  return facts.commitsSince === 0;
}

// True if the build is a release: made at its tag, unmodified (the checks refuse a modified one).
function isRelease(facts) {
  return isAtReleaseTag(facts) && !facts.modified;
}

// The label after the "-": "dev" on main, the branch's label on another branch, "detached" on none.
function labelFor(branch) {
  if (branch === null) {
    return DETACHED_LABEL;
  }
  return branch === MAIN_BRANCH ? MAIN_LABEL : branchLabel(branch);
}

// ".dirty" for a build with changes not committed yet, otherwise "".
function dirtySuffix(facts) {
  return facts.modified ? `.${DIRTY}` : "";
}

// Compares two MAJOR.MINOR.PATCH versions as numbers: negative if a is earlier, 0 if equal, positive
// if later, e.g. compareReleases("0.10.0", "0.9.0") > 0.
function compareReleases(a, b) {
  const partsA = releaseParts(a);
  const partsB = releaseParts(b);
  for (let index = 0; index < partsA.length; index += 1) {
    if (partsA[index] !== partsB[index]) {
      return partsA[index] - partsB[index];
    }
  }
  return 0;
}

// The numbers of a MAJOR.MINOR.PATCH version, e.g. releaseParts("0.2.0") → [0, 2, 0].
function releaseParts(version) {
  return version.split(".").map(Number);
}

// The next minor version after a release, suggested when package.json hasn't moved on,
// e.g. nextMinor("0.2.0") → "0.3.0".
function nextMinor(release) {
  const [major, minor] = releaseParts(release);
  return `${major}.${minor + 1}.0`;
}

// --- Reading the facts ---

// Runs git with the given arguments in a folder and returns what it printed, trimmed.
// Throws git's own error if it fails or can't be run.
function runGit(folder, args) {
  return execFileSync("git", args, {
    cwd: folder,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

// Throws section 5's message unless git runs and the folder is inside a git work tree.
function checkIsClone(git) {
  let answer;
  try {
    answer = git("rev-parse", "--is-inside-work-tree");
  } catch {
    throw new Error(NOT_A_CLONE);
  }
  if (answer !== "true") {
    throw new Error(NOT_A_CLONE);
  }
}

// The most recent release tag reachable from HEAD, without its "v", e.g. "0.1.0",
// or null if there's none (git describe fails when it finds no tag).
function readLastRelease(git) {
  try {
    const excludes = NOT_RELEASE_TAG_PATTERNS.flatMap((pattern) => ["--exclude", pattern]);
    const tag = git("describe", "--tags", "--abbrev=0", "--match", RELEASE_TAG_PATTERN, ...excludes);
    return tag.slice(1);
  } catch {
    return null;
  }
}

// package.json's version in a folder, e.g. "0.2.0".
function readPackageVersion(projectFolder) {
  const packageJson = JSON.parse(readFileSync(resolve(projectFolder, "package.json"), "utf8"));
  return packageJson.version;
}
