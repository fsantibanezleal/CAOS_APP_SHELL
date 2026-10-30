# 09 Versions: one release, two spellings

Every release of the shell has one number written two ways (ADR-0068):

| Where | Spelling | Example |
|---|---|---|
| npm (`npm view @fasl-work/caos-app-shell version`, the npm badge, a product's exact pin in `package.json`) | semver, zeros dropped | `0.19.7` |
| `VERSION`, the CHANGELOG heading, the git tag, the version badge | display form `X.XX.XXX` | `0.19.007`, tag `v0.19.007` |

They are the same release: `0.19.7` on npm is `0.19.007` in `VERSION` and the CHANGELOG, and the tag `v0.19.007` points
at the commit npm records as the package's `gitHead`. npm forbids leading zeros in a version, so the display form
cannot be published as is; the package carries `VERSION` and `CHANGELOG.md` (0.19.007) so the npm page shows both
spellings. `scripts/check_version_coherence.py` holds `VERSION`, `package.json` and the CHANGELOG together in CI and
before each publish, and `test/versionNumbering.test.ts` (SHR-001 to SHR-004) holds this page and the package contents.

## Every version published on npm

Read from the npm registry (`npm view @fasl-work/caos-app-shell@<v> gitHead`) and the repository tags on 2026-10-29. A
tag added on 2026-10-29 is marked "added": it points at the commit npm records for that version; no published tag was
moved or deleted (a published tag is the record of a release that happened).

| npm | Display | Tag | Commit | Note |
|---|---|---|---|---|
| 0.1.0 | 0.01.000 | none | not recorded | npm recorded no commit for this upload, so it cannot be tagged |
| 0.1.1 | 0.01.001 | `v0.01.001` (added) | f712461 | |
| 0.1.2 | 0.01.002 | `v0.01.002` (added) | 737d0e0 | |
| 0.2.0 | 0.02.000 | `v0.2.0` | 7b1bc0a | the only tag in the old unpadded form, kept as published; `v0.02.000` (531f0e8) is the CHANGELOG release commit, not the one published |
| 0.3.0 | 0.03.000 | `v0.03.000` | da502ef | |
| 0.5.0 | 0.05.000 | `v0.05.000` | not recorded | npm recorded no commit; the tag (6d49067) is the CHANGELOG release commit |
| 0.6.0 | 0.06.000 | `v0.06.000` (added) | 89cbe47 | |
| 0.6.1 | 0.06.001 | `v0.06.001` (added) | 89cbe47 | the same commit as 0.6.0, republished |
| 0.6.2 | 0.06.002 | `v0.06.002` (added) | e35e92e | |
| 0.6.3 | 0.06.003 | `v0.06.003` (added) | 3d073e0 | |
| 0.6.4 | 0.06.004 | `v0.06.004` (added) | 8a07275 | |
| 0.6.5 to 0.6.8 | 0.06.005 to 0.06.008 | `v0.06.005` to `v0.06.008` | per tag | |
| 0.6.13 | 0.06.013 | `v0.06.013` | 51babe9 | |
| 0.7.0 to 0.11.2 | 0.07.000 to 0.11.002 | `v<display>` | the tag's commit | |
| 0.12.0, 0.13.0 | 0.12.000, 0.13.000 | `v0.12.000`, `v0.13.000` | not recorded | npm recorded no commit for these two uploads; the tags (012ce46, dd48517) are the CHANGELOG release commits |
| 0.13.1 onward | 0.13.001 onward | `v<display>` | the tag's commit | every later version is on npm and tagged at the commit npm records |

## Numbers that are not on npm

- **0.04.000** (CHANGELOG, 2026-07-28): released in the repository, never published, and never tagged; npm goes from
  0.3.0 to 0.5.0, which carries it.
- **0.06.009 to 0.06.012** (tags `v0.06.009` to `v0.06.012`, 2026-09-24 and 25): released in the repository, never
  published. The npm token that published up to 0.6.8 expired on 2026-09-17 (every `npm publish` answered 401), and
  0.6.13 was the first upload with its replacement, issued 2026-09-26. A product reads those four in the CHANGELOG; on npm it takes 0.6.13,
  which carries them.
