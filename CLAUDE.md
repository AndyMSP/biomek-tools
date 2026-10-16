# CLAUDE.md — biomek-tools

## About this project
Tools that make our Biomek i5 liquid handler (Span-8) easier to use. The project owner (Andy) is
learning to program and must be able to understand every part of the code.

Requirement: each finished tool must open in Edge or Chrome on a lab PC with nothing installed.

## Working together
- Before changing anything, say what you'll change and why, in plain language.
- Keep each change small and about one thing. Don't mix unrelated changes.
- If a request is unclear or seems like a bad idea, say so and ask before proceeding.
- Don't change, rename, or delete anything you weren't asked to touch.
- After each change, summarize what changed in a few sentences.

## Code
- **Readable first.** Choose clear, descriptive names over short ones. Prefer simple code to clever code.
- **One job per piece.** Each function does one thing; each file covers one topic. Keep functions short.
- **Don't repeat yourself.** If the same logic is needed in two places, put it in one function and reuse it.
- **Keep calculations separate from the screen.** Code that computes results shouldn't also handle
  buttons and display, so it can be tested on its own.
- **No hard-coded settings.** Values that might change (names, volumes, paths) live in one settings
  place, not scattered through the code.
- **Check inputs.** Validate what users enter or load, and give error messages that say what's wrong
  and how to fix it.
- **Comment the why.** Each file starts with a short note on its purpose. Comment anything whose
  reason isn't obvious from the code.
- **Build only what's needed now.** Don't add features or flexibility "for later".
- **Ask before adding a library** (outside code). Say what it does, why it's needed, and the alternative.

## Testing
- Code that calculates something has automated tests.
- Each test file sits next to the file it tests, with the same name plus `.test.js`
  (e.g. `plate.js` and `plate.test.js`). Test data (example inputs, known-good outputs) goes in `tests/data/`.
- Test files are never included in the finished tools.
- When fixing a bug, first write a test that shows the bug, then fix it.
- Run all tests before every commit. Don't commit with failing tests.
- Never change a test's expected result just to make it pass; find out why it fails.

## Git
- Commit after each completed, working change.
- Commit messages say what changed and why, in one short line (more detail below it if needed).
- Push after every commit, since work happens on more than one computer.
- Never commit passwords, keys, or personal data.

## Documentation
- Keep README.md current: what the project is, how to set it up, how to run tests.
- Record significant decisions and the reasons for them.
