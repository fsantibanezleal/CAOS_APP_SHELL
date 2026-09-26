"""Assert that a repo's declared version, CHANGELOG and git tags all agree.

WHY THIS EXISTS. `conventions/versioning.md` requires `VERSION` (the source of truth), the manifests
(`package.json` / `pyproject.toml`, semver form with the zeros dropped), the CHANGELOG top entry and a
`vX.XX.XXX` tag to move together on every release. A tag-only sweep on 2026-07-30 found that they routinely
do not: 80 tags across 10 CAOS repos point at commits whose declared version is something else, because a
release got tagged and deployed while the version files stayed put.

That drift is not cosmetic. Every product footer reads its version from a manifest, so the deployed app
tells the user a version older than the release it is running, and the tag stops being usable to answer
"what is live right now". It also produced a real collision: CAOS_FAENA `v0.04.003` was tagged on a commit
declaring `0.04.002`, so the next release picked `0.04.003` from a stale checkout and could not be tagged.

Two modes:

    python check_version_coherence.py <repo>            # CI guard: is THIS working tree coherent?
    python check_version_coherence.py --tags <repo>...   # audit: which existing tags disagree?

The guard mode is what belongs in a repo's `guards` CI job, before the tag is ever created. The audit mode
is for sweeping the line and is deliberately read-only: a published tag is the accurate record of a release
that happened, so drift is fixed by moving the FILES forward, never by rewriting or deleting the tag.
"""
from __future__ import annotations

import io
import json
import os
import re
import subprocess
import sys


def _norm(v: str | None) -> tuple[int, int, int] | None:
    """`0.04.003`, `0.4.3` and `0.4.3-rc1` all normalise to (0, 4, 3).

    The display form is zero-padded and the manifest form is not, so a textual comparison reports a
    mismatch for two spellings of the same version. Only the numbers are compared.
    """
    if not v:
        return None
    m = re.match(r'^v?(\d+)\.(\d+)\.(\d+)', v.strip())
    return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else None


def _read(repo: str, path: str, ref: str | None = None) -> str | None:
    if ref:
        r = subprocess.run(['git', '-C', repo, 'show', f'{ref}:{path}'],
                           capture_output=True, text=True)
        return r.stdout if r.returncode == 0 else None
    full = os.path.join(repo, path)
    return io.open(full, encoding='utf-8').read() if os.path.exists(full) else None


# Every place a CAOS repo may declare its version. A repo is not required to have all of them; it IS
# required that the ones it has agree.
SOURCES = [
    ('VERSION', lambda s: s.strip().splitlines()[0].strip() if s.strip() else None),
    ('frontend/package.json', lambda s: json.loads(s).get('version')),
    ('package.json', lambda s: json.loads(s).get('version')),
    ('pyproject.toml', lambda s: (re.search(r'^version\s*=\s*"([^"]+)"', s, re.M) or [None, None])[1]),
    ('app/pyproject.toml', lambda s: (re.search(r'^version\s*=\s*"([^"]+)"', s, re.M) or [None, None])[1]),
]


def declared(repo: str, ref: str | None = None) -> dict[str, str]:
    out: dict[str, str] = {}
    for path, parse in SOURCES:
        raw = _read(repo, path, ref)
        if raw is None:
            continue
        try:
            v = parse(raw)
        except Exception:
            continue
        if v:
            out[path] = v
    return out


def changelog_top(repo: str, ref: str | None = None) -> str | None:
    raw = _read(repo, 'CHANGELOG.md', ref)
    if not raw:
        return None
    m = re.search(r'^##\s*\[?v?([0-9][0-9.]*)\]?', raw, re.M)
    return m.group(1) if m else None


def guard(repo: str) -> int:
    """CI mode: the working tree must be internally coherent, and its version must not be behind a tag."""
    name = os.path.basename(os.path.abspath(repo))
    decl = declared(repo)
    if not decl:
        print(f'{name}: no version source found (VERSION / package.json / pyproject.toml)')
        return 1

    problems: list[str] = []
    norms = {p: _norm(v) for p, v in decl.items()}
    distinct = {n for n in norms.values() if n}
    if len(distinct) > 1:
        problems.append('manifests disagree: ' + ', '.join(f'{p}={v}' for p, v in decl.items()))

    top = changelog_top(repo)
    if top and distinct and _norm(top) not in distinct:
        problems.append(f'CHANGELOG top entry is {top}, manifests say '
                        + ', '.join(sorted({v for v in decl.values()})))

    tags = subprocess.run(['git', '-C', repo, 'tag'], capture_output=True, text=True).stdout.split()
    tagged = sorted({_norm(t) for t in tags if _norm(t)})
    if tagged and distinct:
        cur = max(distinct)
        if cur < tagged[-1]:
            problems.append(f'declared version {".".join(map(str, cur))} is BEHIND the latest tag '
                            f'{".".join(map(str, tagged[-1]))}: a release was tagged without a bump')

    if problems:
        print(f'{name}: FAIL')
        for p in problems:
            print(f'  - {p}')
        return 1
    print(f'{name}: version coherent ({", ".join(f"{p}={v}" for p, v in decl.items())})')
    return 0


def audit(repos: list[str]) -> int:
    """Read-only sweep: which existing tags point at a commit that declares a different version?"""
    rows = 0
    for repo in repos:
        if not os.path.isdir(os.path.join(repo, '.git')):
            continue
        name = os.path.basename(os.path.abspath(repo))
        tags = subprocess.run(['git', '-C', repo, 'tag', '--sort=v:refname'],
                              capture_output=True, text=True).stdout.split()
        bad = []
        for t in tags:
            want = _norm(t)
            if not want:
                continue
            decl = declared(repo, t)
            if not decl:
                continue                       # nothing declared at that point in history: not a mismatch
            if want not in {_norm(v) for v in decl.values()}:
                bad.append((t, decl))
        if bad:
            print(f'\n{name}: {len(bad)} of {len(tags)} tags disagree with the version declared at them')
            for t, decl in bad:
                print(f'  {t:<12} declares ' + ', '.join(f'{p}={v}' for p, v in decl.items()))
            rows += len(bad)
    print(f'\n{rows} drifted tags total')
    return 0 if rows == 0 else 1


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        raise SystemExit(2)
    if args[0] == '--tags':
        raise SystemExit(audit(args[1:]))
    raise SystemExit(guard(args[0]))
