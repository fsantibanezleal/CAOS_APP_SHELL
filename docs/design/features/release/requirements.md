# Requirements: release

Status: live

EARS (Mavin et al., RE'09, doi:10.1109/RE.2009.9). Every requirement names the test or the gate plant that fails when it is violated. A behaviour with no test is not a row here: it is listed as a gap in the delegation report and gets its row when its test exists.

| ID | Requirement | Gate |
|---|---|---|
| SHR-001 | THE published package SHALL carry `VERSION` and `CHANGELOG.md`, so the npm page shows the display form of the release beside its semver form. | `test/versionNumbering.test.ts::SHR-001: the npm package carries VERSION and the CHANGELOG, so the npm page shows the display form` |
| SHR-002 | THE `package.json` version SHALL be the semver form of `VERSION`, and the CHANGELOG SHALL open on the release `VERSION` names. | `test/versionNumbering.test.ts::SHR-002: package.json holds the semver form of VERSION and the CHANGELOG opens on VERSION` |
| SHR-003 | THE README SHALL show the npm badge beside the release-tag badge, state that the two spellings are one release, and link the version map. | `test/versionNumbering.test.ts::SHR-003: the README names both spellings, with an npm badge beside the tag badge, and links the version map` |
| SHR-004 | THE version map (`docs/09_versions.md`) SHALL name, for each single npm version it lists, its display form and the tag `v<display>`, except the one unpadded tag it documents (`v0.2.0`). | `test/versionNumbering.test.ts::SHR-004: every single-version row of the version map names the tag of its npm version, except the one documented` |
