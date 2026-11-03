## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Domain docs

This repo uses a single-context layout. See `docs/agents/domain.md`.

### Code comments

Load the `code-comments` skill before writing or editing any comment.

### Worktrees

Never edit files or commit in the main checkout, even for a one-line change. Before your first file change or commit, load the `worktrees` skill and resolve a worktree for the work, then work and commit there. Release its lock when the work is committed. The one exception is a main-checkout path a skill names, such as `improve-codebase-architecture`'s notes.
