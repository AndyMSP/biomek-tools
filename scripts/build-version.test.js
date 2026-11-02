// Unit tests for build-version.js. Each test comes from the "Test cases" section of build-version.md.
// readGitFacts isn't unit-tested here, since it runs git; it's checked by hand (section 6).

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildVersion, branchLabel, fileNameFor } from "./build-version.js";

// Facts for a build on main, 488 commits after release 0.1.0, working towards 0.2.0.
const ON_MAIN = {
  packageVersion: "0.2.0",
  lastRelease: "0.1.0",
  commitsSince: 488,
  commit: "3cc65a9",
  branch: "main",
  modified: false,
};

// Facts for a build at the tag of release 0.2.0, on main, unmodified.
const AT_RELEASE = { ...ON_MAIN, lastRelease: "0.2.0", commitsSince: 0 };

// SemVer precedence of two versions (semver.org, item 11), for checking the order of the versions
// buildVersion makes: negative if a comes first. Build metadata (after "+") is ignored.
function compareSemVer(a, b) {
  const [coreA, preA] = splitVersion(a);
  const [coreB, preB] = splitVersion(b);
  const coreOrder = compareIdentifierLists(coreA, coreB);
  if (coreOrder !== 0) {
    return coreOrder;
  }
  if (preA.length === 0 || preB.length === 0) {
    return preB.length - preA.length;
  }
  return compareIdentifierLists(preA, preB);
}

// A version's core and pre-release identifiers, e.g. "0.2.0-dev.5+abc" → [["0","2","0"], ["dev","5"]].
function splitVersion(version) {
  const withoutMetadata = version.split("+")[0];
  const dash = withoutMetadata.indexOf("-");
  if (dash === -1) {
    return [withoutMetadata.split("."), []];
  }
  return [withoutMetadata.slice(0, dash).split("."), withoutMetadata.slice(dash + 1).split(".")];
}

// Compares two lists of identifiers in turn; a shorter list that matches the longer one's start
// comes first.
function compareIdentifierLists(a, b) {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const order = compareIdentifiers(a[index], b[index]);
    if (order !== 0) {
      return order;
    }
  }
  return a.length - b.length;
}

// Compares two identifiers: numbers as numbers, before any text; text in ASCII order.
function compareIdentifiers(a, b) {
  const aIsNumber = /^\d+$/.test(a);
  const bIsNumber = /^\d+$/.test(b);
  if (aIsNumber && bIsNumber) {
    return Number(a) - Number(b);
  }
  if (aIsNumber !== bIsNumber) {
    return aIsNumber ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

describe("build-version", () => {
  // --- buildVersion: section 3's table ---

  test("a release: at its tag, unmodified", () => {
    assert.deepEqual(buildVersion(AT_RELEASE), { short: "0.2.0", full: "0.2.0+3cc65a9" });
  });

  test("a release on a branch or with no branch is still named by its version alone", () => {
    assert.equal(buildVersion({ ...AT_RELEASE, branch: "moving-stages" }).short, "0.2.0");
    assert.equal(buildVersion({ ...AT_RELEASE, branch: null }).short, "0.2.0");
  });

  test("on main", () => {
    assert.deepEqual(buildVersion(ON_MAIN), {
      short: "0.2.0-dev.488",
      full: "0.2.0-dev.488+3cc65a9",
    });
  });

  test("on another branch", () => {
    assert.deepEqual(buildVersion({ ...ON_MAIN, branch: "moving-stages" }), {
      short: "0.2.0-moving-stages.488",
      full: "0.2.0-moving-stages.488+3cc65a9",
    });
  });

  test("on no branch (a detached HEAD)", () => {
    assert.deepEqual(buildVersion({ ...ON_MAIN, branch: null }), {
      short: "0.2.0-detached.488",
      full: "0.2.0-detached.488+3cc65a9",
    });
  });

  test("with changes not committed, on main, another branch and no branch", () => {
    assert.deepEqual(buildVersion({ ...ON_MAIN, modified: true }), {
      short: "0.2.0-dev.488.dirty",
      full: "0.2.0-dev.488.dirty+3cc65a9",
    });
    assert.deepEqual(buildVersion({ ...ON_MAIN, branch: "moving-stages", modified: true }), {
      short: "0.2.0-moving-stages.488.dirty",
      full: "0.2.0-moving-stages.488.dirty+3cc65a9",
    });
    assert.deepEqual(buildVersion({ ...ON_MAIN, branch: null, modified: true }), {
      short: "0.2.0-detached.488.dirty",
      full: "0.2.0-detached.488.dirty+3cc65a9",
    });
  });

  test("a branch's name is made into its label", () => {
    assert.equal(buildVersion({ ...ON_MAIN, branch: "fix/Mix steps" }).short, "0.2.0-fix-Mix-steps.488");
    assert.equal(buildVersion({ ...ON_MAIN, branch: "dev" }).short, "0.2.0-branch-dev.488");
  });

  // --- branchLabel ---

  test("branchLabel makes a branch's name fit for a pre-release identifier", () => {
    assert.equal(branchLabel("moving-stages"), "moving-stages");
    assert.equal(branchLabel("fix/Mix steps"), "fix-Mix-steps");
    assert.equal(branchLabel("--x--"), "x");
    assert.equal(branchLabel("feature//a"), "feature-a");
    assert.equal(branchLabel("ünïcode"), "n-code");
  });

  test("branchLabel prefixes a label that is empty, only digits, dev or detached", () => {
    assert.equal(branchLabel("123"), "branch-123");
    assert.equal(branchLabel("dev"), "branch-dev");
    assert.equal(branchLabel("detached"), "branch-detached");
    assert.equal(branchLabel("///"), "branch-");
  });

  // --- The checks, in section 3's order ---

  test("check 1: package.json's version must be MAJOR.MINOR.PATCH", () => {
    assert.throws(() => buildVersion({ ...ON_MAIN, packageVersion: "0.2" }), {
      message: `package.json's version must be MAJOR.MINOR.PATCH, like 0.2.0, but it's "0.2".`,
    });
    for (const bad of ["0.02.0", "0.2.0-beta", "v0.2.0", "0.2.0.1", "a.b.c", "", undefined]) {
      assert.throws(() => buildVersion({ ...ON_MAIN, packageVersion: bad }), {
        message: /^package\.json's version must be MAJOR\.MINOR\.PATCH/,
      });
    }
  });

  test("check 2: there must be a release tag", () => {
    assert.throws(() => buildVersion({ ...ON_MAIN, lastRelease: null, commitsSince: null }), {
      message:
        "No release tag (like v0.1.0) was found. Fetch the tags: git fetch --tags " +
        "(a clone without history may also need --unshallow)",
    });
  });

  test("check 3: at a release tag, package.json must be that release", () => {
    assert.throws(() => buildVersion({ ...AT_RELEASE, packageVersion: "0.3.0" }), {
      message:
        "This commit is release v0.2.0, but package.json says 0.3.0. " +
        "Build the release from a commit whose package.json says 0.2.0.",
    });
  });

  test("check 4: at a release tag, the build must be unmodified", () => {
    assert.throws(() => buildVersion({ ...AT_RELEASE, modified: true }), {
      message:
        "This commit is release v0.2.0, but it has changes not committed yet. " +
        "Commit or discard them, or build from a later commit.",
    });
  });

  test("check 5: elsewhere, package.json must be greater than the last release", () => {
    assert.throws(() => buildVersion({ ...ON_MAIN, lastRelease: "0.2.0" }), {
      message:
        "package.json says 0.2.0, but 0.2.0 has been released. " +
        "Set the next version first: npm version 0.3.0 --no-git-tag-version",
    });
    assert.throws(() => buildVersion({ ...ON_MAIN, packageVersion: "0.1.5", lastRelease: "1.0.0" }), {
      message: /^package\.json says 0\.1\.5, but 1\.0\.0 has been released\. .*npm version 1\.1\.0 /,
    });
  });

  test("the checks refuse in section 3's order", () => {
    // Checks 1 and 2 both fail: check 1's message.
    assert.throws(() => buildVersion({ ...ON_MAIN, packageVersion: "0.2", lastRelease: null }), {
      message: /^package\.json's version must be/,
    });
    // Checks 3 and 4 both fail: check 3's message.
    assert.throws(() => buildVersion({ ...AT_RELEASE, packageVersion: "0.3.0", modified: true }), {
      message: /but package\.json says 0\.3\.0/,
    });
  });

  test("versions are compared as numbers, not as text", () => {
    assert.equal(
      buildVersion({ ...ON_MAIN, packageVersion: "0.10.0", lastRelease: "0.9.0" }).short,
      "0.10.0-dev.488",
    );
    assert.equal(
      buildVersion({ ...ON_MAIN, packageVersion: "0.9.1", lastRelease: "0.9.0" }).short,
      "0.9.1-dev.488",
    );
    assert.throws(() => buildVersion({ ...ON_MAIN, packageVersion: "0.9.0", lastRelease: "0.10.0" }), {
      message: /^package\.json says 0\.9\.0, but 0\.10\.0 has been released/,
    });
  });

  // --- fileNameFor ---

  test("fileNameFor names a release and a build between releases", () => {
    assert.equal(fileNameFor("transfer-designer", buildVersion(AT_RELEASE)), "transfer-designer-v0.2.0.html");
    assert.equal(
      fileNameFor("transfer-designer", buildVersion(ON_MAIN)),
      "transfer-designer-v0.2.0-dev.488.html",
    );
  });

  // --- SemVer order ---

  test("sorted as SemVer, the versions made fall in build order", () => {
    const release010 = buildVersion({ ...ON_MAIN, packageVersion: "0.1.0", lastRelease: "0.1.0", commitsSince: 0 });
    const dev5 = buildVersion({ ...ON_MAIN, commitsSince: 5 });
    const dev12 = buildVersion({ ...ON_MAIN, commitsSince: 12 });
    const release020 = buildVersion(AT_RELEASE);
    const expected = [release010, dev5, dev12, release020].map((version) => version.full);
    const shuffled = [dev12, release020, release010, dev5].map((version) => version.full);
    assert.deepEqual([...shuffled].sort(compareSemVer), expected);
    assert.deepEqual(expected, ["0.1.0+3cc65a9", "0.2.0-dev.5+3cc65a9", "0.2.0-dev.12+3cc65a9", "0.2.0+3cc65a9"]);
  });
});
