# CLAUDE.md — biomek-tools

## About this project
Tools that make our Biomek i5 liquid handler (Span-8) easier to use. The project owner (Andy) is
learning to program and must be able to understand every part of the code.

Requirement: each tool handed out to the lab must open in Edge or Chrome on a lab PC with nothing
installed.

## Working together
- Before changing anything, say what you'll change and why, in plain language.
- Keep each change small and about one thing. Don't mix unrelated changes.
- If a request is unclear or seems like a bad idea, say so and ask before proceeding.
- Don't change, rename, or delete anything you weren't asked to touch.
- After each change, summarize what changed in a few sentences.

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
- **Extensible design, no speculative features (YAGNI).** Structure code so new features can be added
  as new modules, but implement only what the current specification requires.
- **Ask before adding a dependency.** Say what it does, why it's needed, and the alternative.

## Project layout
```
biomek-tools/
├── CLAUDE.md
├── README.md
├── CHANGELOG.md           added at the first release
├── package.json           project metadata and npm scripts (test, build)
├── .gitignore
├── .gitattributes
├── docs/
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
  behavior, update its specification first, then the code and tests.
- **Create directories only when their first file is needed.**

## Domain knowledge
- Don't guess about instrument behavior or file formats. Check `docs/domain/`; if the fact isn't
  there, ask.
- Every entry records its source: manual part number and section, or "verified on instrument" with
  the date.
- Vendor manuals are not committed; entries cite them by part number.

## Testing
- Every module that computes something has unit tests.
- Test fixtures go in `tests/fixtures/`.
- When fixing a bug, first write a failing test that reproduces it, then fix it.
- Run the full test suite (`npm test`) before every commit. Never commit with failing tests.
- Never change a test's expected result just to make it pass; find out why it fails. Never edit a
  golden file to make a test pass.

## Git
- Commit after each completed, working change.
- Commit messages: a short summary line saying what changed and why, with details in the body if
  needed.
- Push after every commit, since work happens on more than one computer.
- Never commit secrets (passwords, keys) or personal data.

## Releases
- `npm run build` creates the build output in `dist/`.
- Tools are distributed as release assets on GitHub Releases, using semantic versioning
  (e.g. v1.0.0). Each release gets a `CHANGELOG.md` entry.

## Documentation
- Keep README.md current: what the project is, how to set it up, how to run tests and build.
- Record each significant decision as an ADR in `docs/adr/`: context, decision, consequences.
