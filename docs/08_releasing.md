# 08 Releasing

## Versions

`VERSION` holds the display form `X.XX.XXX` (ADR-0068); `package.json` holds its semver form (0.08.000 is 0.8.0); the
top CHANGELOG entry and the tag `vX.XX.XXX` agree with it (`scripts/check_version_coherence.py`, in CI). A fix is a
patch; a new primitive, a new check or a changed default is a minor version.

## Steps

1. An issue names the defect or the requirement; a branch `task/<slug>` from `develop`.
2. The requirement first (a row, new or amended, with its ID, in `docs/design/features/<area>/requirements.md`), then
   the change with its test, which names that ID in its title or a comment: a unit test in `test/`, and for the gate a
   planted defect in `test/gate-selftest.mjs` with its fixture state. `npm test`, `npm run test:browser`,
   `npm run test:gate` and `npm run check:sdd` pass (`check:sdd` also runs in CI, ADR-0075).
3. `VERSION`, `package.json`, the CHANGELOG entry (what was wrong, in which product it was found, what a product does
   on adoption); the SDD (`docs/design/SDD.md`, section Versions and adoption) and the CHANGELOG entry agree on what the release
   carries; the known-defects record in CAOS_MANAGE (`conventions/shell-known-defects.md`) closes the entries
   the release carries.
4. PR into `develop`, then `develop` into `main`; the tag on `main`; a GitHub release from the tag.
5. Publish to npm (below), then `npm view @fasl-work/caos-app-shell version` shows the release in its semver form and its
   `gitHead` is the tag's commit ([`09_versions.md`](09_versions.md)).

## npm

`.github/workflows/publish-npm.yml` publishes on a GitHub release through npm Trusted Publishing (OIDC, environment
`npm`, provenance): it checks `VERSION`, `package.json`, the CHANGELOG and the tag against each other, runs the tests and
publishes. Every release from 0.19.000 was published by it; before that, releases went out with a direct-publish token
from a clean clone of the tag, and four (0.06.009 to 0.06.012) never reached npm while the token was being replaced.
After the release, `npm view @fasl-work/caos-app-shell@<semver> gitHead` is the tag's commit; the version map
[`09_versions.md`](09_versions.md) gets a row of its own only for a release that breaks that rule.

## Products

A product pins the shell exactly (`"@fasl-work/caos-app-shell": "0.8.0"`, never a caret), so the build it gated is the
build it ships; it records the template version it was made from in `.template-version`. It moves to a new release when
its owner names it (ADR-0078 section 5): it bumps the pin, removes the overrides the release makes unnecessary (each
CHANGELOG entry says which), and passes the gate again.
