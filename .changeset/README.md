# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets).
Each PR that should ship a release includes a changeset describing the bump.

```bash
bun run changeset        # add a changeset (pick patch/minor/major + summary)
```

On merge to `main`, the Release workflow consumes pending changesets, bumps the
version + changelog, commits that back to `main`, and publishes `@chuvenger/devdock`
to npm. A merge with no changeset publishes nothing new (unless the current
version isn't on npm yet).
