<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:git-workflow -->
# Git Workflow

This project uses a two-branch strategy with selective cherry-picking:

## Branch Structure
- **main**: Production branch with clean code-only history
- **dev**: Development branch with full history (code + documentation in `.planning/`)

## Workflow
1. All development work happens on `dev` branch
2. Commits on `dev` include both code changes (`feat:`, `fix:`, `chore:`) and documentation (`docs:`)
3. To update `main`, cherry-pick only code commits from `dev` to `main`:
   ```bash
   git checkout main
   git cherry-pick <feat-commit> <fix-commit> <chore-commit>
   # Skip all docs: commits
   ```
4. Never cherry-pick from `main` back to `dev` (dev is always ahead)
5. Never squash merge (loses granular history)

## Commit Conventions
- `feat:` - New features (cherry-pick to main)
- `fix:` - Bug fixes (cherry-pick to main)
- `chore:` - Maintenance tasks (cherry-pick to main)
- `docs:` - Documentation only (keep on dev only)

## Current State
- Common ancestor: Both branches share the same code
- main: Clean production history
- dev: Full history with `.planning/` documentation
- Backup: `dev-backup-20260401-032615` (if needed)
<!-- END:git-workflow -->
