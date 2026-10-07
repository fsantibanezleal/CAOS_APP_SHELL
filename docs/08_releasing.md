# 08 Releasing

## Versions

`VERSION` holds the display form `X.XX.XXX` (ADR-0068); `package.json` holds its semver form (0.08.000 is 0.8.0); the
top CHANGELOG entry and the tag `vX.XX.XXX` agree with it (`scripts/check_version_coherence.py`, in CI). A fix is a
patch; a new primitive, a new check or a changed default is a minor version.

## Steps

1. An issue names the defect or the requirement; a branch `task/<slug>` from `develop`.
2. The change with its test: a unit test in `test/`, and for the gate a planted defect in `test/gate-selftest.mjs`
   with its fixture state. `npm test`, `npm run test:browser`, `npm run test:gate` pass.
3. `VERSION`, `package.json`, the CHANGELOG entry (what was wrong, in which product it was found, what a product does
   on adoption); the known-defects record in CAOS_MANAGE (`conventions/shell-known-defects.md`) closes the entries
   the release carries.
4. PR into `develop`, then `develop` into `main`; the tag on `main`; a GitHub release from the tag.
5. Publish to npm (below), then `npm view @fasl-work/caos-app-shell version` shows the release.

## npm

`.github/workflows/publish-npm.yml` publishes on a GitHub release through npm Trusted Publishing (OIDC, environment
`npm`, provenance). It has never published: the package page has no Trusted Publisher yet (the upload of 0.7.0 answered
E404). Until it has one, a release is published with the vault's direct-publish token from a clean clone of the tag
(`npm ci`, `npm test`, `npm publish --access public`), as 0.6.13 and 0.7.0 to 0.7.2 were. npm stops accepting
direct-publish tokens in January 2027; configuring the Trusted Publisher (user `fsantibanezleal`, repository
`CAOS_APP_SHELL`, workflow `publish-npm.yml`, environment `npm`) is the owner's switch on the package page.

## Products

A product pins the shell exactly (`"@fasl-work/caos-app-shell": "0.8.0"`, never a caret), so the build it gated is the
build it ships; it records the template version it was made from in `.template-version`. It moves to a new release when
its owner names it (ADR-0078 section 5): it bumps the pin, removes the overrides the release makes unnecessary (each
CHANGELOG entry says which), and passes the gate again.
