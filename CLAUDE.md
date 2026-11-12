# CLAUDE.md — biomek-tools

## About this project
Tools that make our Biomek i5 liquid handler (Span-8) easier to use. The project owner (Andy) is
learning to program. He decides what the tools do and checks what they produce; he doesn't need to
understand every line of code (Andy, 2026-10-30).

Requirement: each tool handed out to the lab must open in Edge or Chrome on a lab PC with nothing
installed.

## Working together
Andy is learning, so explanations matter as much as the code.
- **Andy owns what affects the lab:** behavior (what a page does, what goes into the Biomek files),
  domain facts, and anything hard to undo (merges, releases, real runs). He checks results rather
  than reading code: his own test of the page, golden files, and a simulation run before any real
  run.
- **Claude handles the details:** error messages, test lists and code structure in specifications,
  and reviewing Claude Code's work. Bring Andy only what needs his decision or his test.
- **Learning is Andy's choice.** When he asks to understand something, explain it slowly, one piece
  at a time, as below.
- **Go slowly when explaining.** When Andy asks to understand something, explain one piece at a
  time and wait before moving on. When reviewing code, go line by line if asked. Don't cover several
  topics in one reply.
- **Use standard industry terms.** Explain each term the first time it comes up. Don't invent
  terms; if there's no standard one, say so.
- **Use American spelling** (color, center), in code, documents and replies.
- **Don't assume understanding.** Treat a topic as understood only if Andy says so. Explain
  anything that depends on an earlier topic from scratch, not by referring back.
- **Be honest.** Give a real opinion and push back when something seems wrong. Don't agree just
  because Andy suggested it, and don't change a recommendation without a new reason; say what the
  reason is.
- **One source of truth.** Don't repeat in chat what a pull request's description says. In chat,
  say what happened, which PR, and the one thing needed from Andy; if a description changes, say so
  in a line (Andy, 2026-10-30).
- **Make questions clear.** Say whether a question asks for Andy's decision or checks his
  understanding.
- Before changing anything, say what you'll change and why, in plain language.
- Keep each change small and about one thing. Don't mix unrelated changes.
- If a request is unclear or seems like a bad idea, say so and ask before proceeding.
- Don't change, rename, or delete anything you weren't asked to touch.
- After each change, summarize what changed in a few sentences.
- **Try first, then make it properly.** Changes to how a page looks or behaves are tried first in a
  preview: a scratch copy outside the repository that Andy can open and use. Only once he likes it
  does the change go in properly: specification first, then code and tests. A preview published
  to Andy's preview artifact says `Preview: ` before the tool's name in its `<title>`, and routes
  its downloads through the artifact's save prompt (the `downloads` capability), since the
  artifact viewer blocks ordinary downloads; both are preview-only patches to the built file,
  never committed (Andy, 2026-10-31: he built a plan in a preview thinking it was the real tool).
- **Wrap up.** When Andy says "wrap up", or a piece of work ends, list what was decided or learned
  and suggest where each item belongs (see "Where knowledge lives"). Save only what Andy approves.

## Who does what
- **Claude, in a chat,** writes specifications, ADRs and other documents, tries page changes in
  previews, and reviews Claude Code's pull requests: starting from the description, then checking
  the changes against it and against the specifications, and checking pages in a real browser.
  For larger changes, Claude also has a separate agent review the work, given only the changes and
  the specifications, not Claude's conclusions; Claude checks what it finds and passes on what
  matters.
- **Claude may have a background agent write a topic's specifications** (Andy, 2026-11-11), so the
  chat can go on with the next topic. Claude briefs it with everything Andy approved, reads what it
  writes, and has the specifications reviewed by a separate agent as usual.
- **Claude Code** writes the code and tests, from the specifications only, in a new session each
  time, so the specifications must say everything it needs. **Claude starts it** (Andy,
  2026-10-30): once Andy approves a PR's specifications, Claude starts the build as a background
  agent, in its own copy of the repository (a git worktree), with only the specifications and the
  repository to go on, pushing to the PR's branch. Claude then reviews the build, puts it in Andy's
  preview, and sends Andy a notification when it's ready for his test.
- **Decisions for later work go into the repository straight away** (Andy, 2026-10-30): a decision
  about a piece of work not yet specified goes into that work's roadmap entry at once, not only into
  a chat or a project file, so it can't be lost before the specification is written. It goes onto
  the topic's branch and is pushed; the pushed branch is the record. **One pull request per
  topic** (Andy, 2026-10-30): the topic's decisions, its specifications and its build share one
  branch and one pull request, reviewed and merged once, not one merge per decision.
- **Exception:** a very small code fix (a few lines, found in a review) can be made in the chat,
  still specification first, on its own branch with a pull request (Andy, 2026-10-26).

## Workflows
Andy chooses a workflow for each topic (Andy, 2026-11-01). The standard workflow is the default; the
hands-off workflow is used only when Andy asks for it.
- **Standard workflow:** as above. Andy approves a pull request's specifications before the build
  starts, and questions that need his decision are asked as they come up.
- **Hands-off workflow:** Claude carries a topic from specification to Andy's test without
  stopping. Where a question would need Andy's decision, Claude takes its own recommendation, notes
  the decision and its reason, and carries on. The steps:
  1. A branch for the topic, from the latest `main`.
  2. The specifications, marked **Draft**, with the roadmap entry, an ADR and glossary terms as
     needed; each committed and pushed.
  3. The pull request, whose **For Andy** lists every decision Claude made for him, with its reason.
  4. A review of the specifications by a separate agent, given only the specifications; Claude
     fixes what matters.
  5. The build, by Claude Code, as in "Who does what", from the specifications only.
  6. A review of the build: Claude checks it against the description and the specifications, runs
     `npm test` and checks pages in a real browser; a separate agent reviews the code against the
     specifications without Claude's conclusions. Fixes go specification first, back to the same
     build agent or, for a few lines, made in the chat.
  7. The roadmap entry says "built (#N)", the build goes to Andy's preview, and Andy gets a
     notification.
  8. One report: the pull request, what to test, the decisions made for Andy and why, and any
     questions still open.

  Still Andy's, even in this workflow: merging, real runs, anything hard to undo, and any change to
  what goes into the Biomek files. For these, Claude does the preparatory work, sets out the
  decision and stops. The decisions Claude made stand as proposals until Andy merges the pull
  request.

  **A builder sees only the specifications** (Andy, 2026-11-11). Claude never hands a build or fix
  agent code from elsewhere (a preview, a scratch branch, Claude's own patch), nor tells it to copy
  what such code does. A fix found later goes into the specifications first, then to a builder that
  hasn't seen the other code.

## Code
- **Readability first.** Use clear, descriptive names. Prefer simple code to clever code.
- **Single responsibility.** Each function does one thing; each module covers one topic. Keep
  functions short.
- **Don't repeat yourself (DRY).** Logic needed in more than one place lives in one function and is
  reused.
- **Separate logic from the UI.** Modules that compute results contain no DOM or UI code, so they can
  be unit-tested in Node.
- **No hard-coded configuration.** Values that might change (labware names, volumes, paths) live in
  `config/`, not in the code.
- **Validate input.** Check everything users enter or load. Error messages say what's wrong and how to
  fix it.
- **Comment the why.** Each module starts with a header comment stating its purpose. Comment anything
  whose reason isn't obvious from the code.
- **Describe every function.** Every function, including constructors, getters, private methods and
  helpers, has a comment above it saying what it does, with an example where it helps. Exception:
  the unnamed functions passed to `test(...)` and `describe(...)` don't get a comment, because the
  test's or group's name already says what it does.
- **Extensible design, no speculative features (YAGNI).** Structure code so new features can be added
  as new modules, but implement only what the current specification requires.
- **Ask before adding a dependency.** Say what it does, why it's needed, and the alternative.
- **Keep the REPL complete.** Every new module is added to `scripts/repl.js`, with a topic of its
  own, so it can be tried by hand with `npm run repl`.

## Project layout
```
biomek-tools/
├── CLAUDE.md
├── README.md
├── CHANGELOG.md           what changed in each release
├── package.json           project metadata and npm scripts (test, build)
├── .gitignore
├── .gitattributes
├── docs/
│   ├── roadmap.md         where things stand, what's next, open decisions, technical debt
│   ├── glossary.md        the project's own terms, such as "stage", defined once
│   ├── adr/               architecture decision records, one per decision
│   └── domain/            domain knowledge: verified facts, one file per subject (e.g. biomek.md)
├── src/
│   ├── shared/<module>/   one directory per module used by more than one tool
│   └── tools/<tool>/      one directory per tool
├── tests/
│   └── fixtures/          test fixtures, including golden files (verified-correct outputs)
├── config/                configuration files
├── scripts/               build script and other development scripts
└── dist/                  build output; not committed
```
- **Co-location.** Each module's source, unit tests, and specification sit together in the module's
  directory: `name.js`, `name.test.js`, and `name.md`. Never use `.spec.` in file names.
- **Specifications.** Each tool and each shared module has a specification (`name.md`). It is the
  source of truth for the module's required behavior; implement against it. To change a module's
  behavior, update its specification first, then the code and tests. A tool's page (its HTML, CSS
  and page script) has one specification, `<tool>-page.md`.
- **Logic specifications don't describe the page.** The specification of a logic or shared module
  says what the module does and who uses it in general terms (a tool, the caller), never what a
  tool's page shows or when it asks the user; that belongs in `<tool>-page.md`. A tool's logic
  specification may point to its own page specification.
- **Create directories only when their first file is needed.**

## Domain knowledge
- Don't guess about instrument behavior or file formats. Check `docs/domain/`; if the fact isn't
  there, ask.
- Every entry records its source: manual part number and section, or "verified on instrument" with
  the date.
- Vendor manuals are not committed; entries cite them by part number.

## Testing
- Every module that computes something has unit tests.
- Each test file wraps its tests in one `describe(...)` group named after the module (e.g.
  `describe("well-grid", …)`), so the test output shows which module each test belongs to.
- Test fixtures go in `tests/fixtures/`.
- When fixing a bug, first write a failing test that reproduces it, then fix it.
- Run the full test suite (`npm test`) before every commit. Never commit with failing tests.
- Never change a test's expected result just to make it pass; find out why it fails. Never edit a
  golden file to make a test pass.
- **Tests follow `config/`.** A test of behavior that depends on a value in `config/` works out its
  numbers from that value, so changing `config/` never breaks a test; only the tests of the config
  file itself name a number. Likewise, a specification gives a config value's number once, where it
  describes the config file, and elsewhere uses its name (Andy, 2026-10-30).

## Git
- Never commit directly to `main`. Do each task on its own branch, created from the latest `main`
  and named for the task (e.g. `well-grid`).
- Commit after each completed, working change.
- Commit messages: a short summary line saying what changed and why, with details in the body if
  needed.
- Push the branch after every commit, since work happens on more than one computer.
- When the task is done, open a pull request. Only Andy merges into `main`.
- **A specification and the code built from it may share one pull request** (Andy, 2026-10-30): the
  specification commits come first, and Andy reviews them; then Claude Code builds on the same
  branch and pushes there, adding a "Build" section to the PR's description instead of opening a new
  PR. Anything the build or its review shows about the specification is fixed in the same PR.
- A pull request's description starts with **For Andy**: three to five plain-language points that
  need his decision or his test, and nothing else. Below it, it summarizes what changed and lists
  any choices made where a specification left room, for whoever reviews it. A review starts from the
  description, then checks the changes against it and against the specifications.
- Start the next task's branch only after the previous one is merged, unless Andy says otherwise.
- **Trying several pull requests together** (Andy, 2026-11-11): Claude merges them into a separate
  branch (e.g. `combined-preview`) that is never merged and has no pull request, and builds it for
  Andy. A fix needed only because they meet is made there to try them, and goes into one of the pull
  requests properly (specification first) before it is merged. The branch is deleted afterwards.
- **Squash and merge** a pull request whose history has false starts (e.g. a design that was
  dropped), so `main` gets one commit with the final result (Andy, 2026-11-11).
- Never commit secrets (passwords, keys) or personal data.

## Releases
- `npm run build` creates the build output in `dist/`.
- Tools are distributed as release assets on GitHub Releases, using semantic versioning
  (e.g. v1.0.0). Each release gets a `CHANGELOG.md` entry.

## Documentation
- Keep README.md current: what the project is, how to set it up, how to run tests and build.
- Record each significant decision as an ADR in `docs/adr/`: context, decision, consequences.
- Keep the roadmap's "Where things stand" current whenever work finishes or a decision is made.
  A topic's entry is updated on the topic's own branch, so its merge carries it: when a build goes
  to Andy's preview, the entry says "built (#N)" in the same commit; being on `main` then means it
  passed his test and was merged (Andy, 2026-10-31).
- **Draft or Final.** A specification written in a hurry, to meet a deadline, says **Draft** at the
  top, with what still needs review. Once it has been reviewed, it says **Final**, or loses the line.
- **Technical debt.** Every shortcut taken knowingly goes in the roadmap's "Technical debt" section:
  what was done, why, and what doing it properly would mean.
- **Only lasting things in ADRs and the glossary.** An ADR records a decision meant to last; its
  status (Proposed, Accepted, Superseded) shows where it stands, and a later ADR supersedes it if it
  changes. A temporary choice goes in a Draft specification and in Technical debt instead. The
  glossary holds definitions, which don't change with the version being built.
- Use a term from `docs/glossary.md` with that meaning only. Add a new project term there when it's
  first decided.

## Where knowledge lives
Chats are for thinking things through; they are not a record. Anything worth keeping goes into the
repository, so a new session never needs an old chat:
- how a module or tool behaves → its specification (`name.md`);
- why something was decided → an ADR in `docs/adr/`;
- where things stand, what's next, open decisions, ideas and technical debt → `docs/roadmap.md`;
- what the project's own terms mean → `docs/glossary.md`;
- facts about the instrument, its files and the lab's methods → `docs/domain/`, with sources;
- what changed in each release → `CHANGELOG.md`.

Start each session by reading this file, the whole roadmap, and the glossary. If the roadmap grows
too long to read in full, move old history out of it rather than reading less of it.
