#!/usr/bin/env python3
"""The SDD gate (ADR-0075): the design document exists and every requirement names a gate that is real.

Ported from CAOS_PRODUCT_TEMPLATE's scripts/check_sdd.py, fitted to the shell's format and its test layout, and
hardened after the adversarial review of PR #100 (CAOS_MANAGE wip/app-shell/review-pr100-sdd-2026-10-11.md).

Checks, in increasing strength:

1. ``docs/design/SDD.md`` exists with the ten sections, in order, each a level-2 heading ``## <name>`` (an optional
   ``N.`` prefix is allowed) outside code fences and HTML comments, each with a non-blank line under it.
2. Every requirements file (``docs/design/features/<area>/requirements.md``) has ``# Requirements: <area>``, exactly
   one ``Status:`` line (live, planned or superseded) and a ``| ID | Requirement | Gate |`` table. Every line that
   starts with ``|`` is a row: a row with fewer than three cells or an empty ID is a finding, and every
   ``SH?-NNN`` token in the file must be the ID of a row.
3. Every row has an ID matching ``SH[DFWCKNTAG]-NNN`` (unique across all files), a statement with SHALL and a gate.
4. **The named gate exists and can fail.** A live gate cell names, in backticks, one or more ``test/<file>::<name>``
   or ``e2e/<file>::<name>``: the name is the first string argument of a ``test(`` or ``it(`` call that starts its
   line (not inside a string, a comment or another test's body), and the call is not skipped (no ``.skip``,
   ``.todo``, ``{ skip: ... }`` or ``{ todo: ... }``); in ``test/gate-selftest.mjs`` a plant id (``id: '<id>'``)
   counts too. ``describe(`` is not a gate (a block proves nothing by itself), and a plain file path is not a gate
   for a live row. A path that resolves outside the repository is a finding.

``Status: planned`` and ``Status: superseded`` take an area out of check 4 only when the area is listed, with its
reason, in ``docs/design/features/.status-allow`` (one ``<area>: <reason>`` per line), reviewed with the pull request
that adds it; otherwise the status itself is a finding. A planned row still names the test file it will have.

Standard library only; exit 1 on any finding. Usage: ``python scripts/check_sdd.py [repo_root]``.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
SDD = ROOT / "docs" / "design" / "SDD.md"
FEATURES = ROOT / "docs" / "design" / "features"
ALLOW = FEATURES / ".status-allow"

SECTIONS = (
    "Problem and non-goals", "Dimensioning", "Technology and versions", "Contracts", "Components",
    "Degradation and dependency states", "Verification", "Versions and adoption", "Risks", "ADR fit",
)
ID_RE = re.compile(r"^SH[DFWCKNTAG]-\d{3}$")
ID_TOKEN = re.compile(r"\bSH[DFWCKNTAG]-\d{3}\b")
TICKED = re.compile(r"`([^`]+)`")
FILE_LIKE = re.compile(r"^[\w./-]+\.(py|ts|tsx|mjs|js|json|md|yml|yaml|css)(::[^`]+)?$")
HEADER = re.compile(r"^#\s+Requirements:\s*\S", re.M)
STATUS = re.compile(r"^Status:\s*(live|planned|superseded)\s*$", re.M | re.I)
STATUS_ANY = re.compile(r"^Status:", re.M | re.I)
SELFTEST = "test/gate-selftest.mjs"
FENCE = re.compile(r"^\s*```.*?^\s*```[^\n]*$", re.M | re.S)
HTML_COMMENT = re.compile(r"<!--.*?-->", re.S)


def _strip_markup(text: str) -> str:
    return HTML_COMMENT.sub("", FENCE.sub("", text.replace("\r\n", "\n")))


def sdd_findings() -> list[str]:
    if not SDD.is_file():
        return [f"{SDD.relative_to(ROOT).as_posix()} is missing"]
    lines = _strip_markup(SDD.read_text(encoding="utf-8")).splitlines()
    sections: list[tuple[str, bool]] = []  # (heading, has a non-blank line before the next heading)
    for ln in lines:
        if ln.startswith("## "):
            sections.append((re.sub(r"^\d+[.)]?\s*", "", ln[3:].strip()).lower(), False))
        elif ln.startswith("#"):
            continue
        elif ln.strip() and sections:
            sections[-1] = (sections[-1][0], True)
    headings = [h for h, _ in sections]
    out: list[str] = []
    last = -1
    for name in SECTIONS:
        if name.lower() not in headings:
            out.append(f"SDD.md has no section for {name!r}")
            continue
        at = headings.index(name.lower())
        if not sections[at][1]:
            out.append(f"SDD.md section {name!r} is empty")
        if at < last:
            out.append(f"SDD.md section {name!r} is out of order")
        last = max(last, at)
    return out


def _code(path: Path) -> str:
    """The file's text without block comments and // comments (a // inside a string is rare in test files and only
    hides a name, never invents one)."""
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"(^|[^:'\"`])//.*$", r"\1", text, flags=re.M)


def test_state(path: Path, name: str) -> str:
    """'ok', 'skipped' or 'absent' for the named test (or plant) in the file."""
    text = _code(path)
    if path.as_posix().endswith(SELFTEST) and re.search(rf"""\bid:\s*(['"`]){re.escape(name)}\1""", text):
        return "ok"
    call = re.compile(rf"""^[ \t]*(?:test|it)((?:\.\w+)*)\(\s*(['"`]){re.escape(name)}\2(\s*,\s*\{{[^}}]*\}})?""", re.M)
    found = "absent"
    for m in call.finditer(text):
        modifiers, options = m.group(1) or "", m.group(3) or ""
        if re.search(r"\.(skip|todo)\b", modifiers) or re.search(r"\b(skip|todo)\s*:", options):
            found = "skipped"
            continue
        return "ok"
    return found


def refs(gate: str) -> list[str]:
    return [t.strip() for t in TICKED.findall(gate) if FILE_LIKE.match(t.strip())]


def gate_findings(rel: str, rid: str, gate: str) -> list[str]:
    named = refs(gate)
    if not named:
        return [f"{rel} {rid}: the gate names no file ({gate.strip()[:80]!r})"]
    out: list[str] = []
    for target in named:
        path_part, _, name = target.partition("::")
        path = (ROOT / path_part).resolve()
        if not path.is_relative_to(ROOT):
            out.append(f"{rel} {rid}: names {path_part!r}, which resolves outside the repository")
        elif not (path_part.startswith("test/") or path_part.startswith("e2e/")):
            out.append(f"{rel} {rid}: names {path_part!r}; a live gate is a test under test/ or e2e/")
        elif not name:
            out.append(f"{rel} {rid}: names {path_part!r} but names no test in it (`path::name`)")
        elif not path.is_file():
            out.append(f"{rel} {rid}: names {path_part!r}, which does not exist")
        else:
            state = test_state(path, name)
            if state == "skipped":
                out.append(f"{rel} {rid}: {path_part} test {name!r} is skipped or todo, so it cannot fail")
            elif state == "absent":
                out.append(f"{rel} {rid}: {path_part} defines no test or plant {name!r} (a test( or it( call at the start of a line)")
    return out


def _allowed() -> dict[str, str]:
    if not ALLOW.is_file():
        return {}
    out: dict[str, str] = {}
    for ln in ALLOW.read_text(encoding="utf-8").splitlines():
        if ln.strip() and not ln.lstrip().startswith("#"):
            area, _, reason = ln.partition(":")
            out[area.strip()] = reason.strip()
    return out


def _rows(text: str) -> tuple[list[list[str]], list[str]]:
    """Every table line outside a code fence: the parsed rows and the malformed ones."""
    rows: list[list[str]] = []
    bad: list[str] = []
    for line in _strip_markup(text).splitlines():
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|", 2)]
        if cells and (cells[0] == "ID" or set(cells[0]) <= set("-: ") and cells[0]):
            continue
        if len(cells) < 3 or not cells[0] or line != line.lstrip():
            bad.append(line.strip()[:80])
            continue
        rows.append(cells)
    return rows, bad


def main() -> int:
    findings = sdd_findings()
    live = planned = 0
    skipped: list[str] = []
    pending: list[str] = []
    seen: dict[str, str] = {}
    allowed = _allowed()
    files = sorted(FEATURES.glob("*/requirements.md"))
    if not files:
        findings.append("docs/design/features/ has no <area>/requirements.md")
    for req in files:
        rel = req.relative_to(ROOT).as_posix()
        area = req.parent.name
        text = req.read_text(encoding="utf-8").replace("\r\n", "\n")
        head = "\n".join(text.splitlines()[:6])
        if not HEADER.search(head):
            findings.append(f"{rel}: the first lines lack '# Requirements: <area>'")
        if len(STATUS_ANY.findall(text)) > 1:
            findings.append(f"{rel}: more than one Status line")
        status = STATUS.search(head)
        if not status:
            findings.append(f"{rel}: the first lines lack 'Status: live', 'planned' or 'superseded'")
            continue
        state = status.group(1).lower()
        if state != "live" and area not in allowed:
            findings.append(f"{rel}: Status {state} takes the area out of the gate; list it with its reason in "
                            f"docs/design/features/.status-allow")
            continue
        if state == "superseded":
            skipped.append(area)
            continue
        if not re.search(r"^\|\s*ID\s*\|\s*Requirement\s*\|\s*Gate\s*\|", text, re.M):
            findings.append(f"{rel}: no '| ID | Requirement | Gate |' table")
        rows, bad = _rows(text)
        findings.extend(f"{rel}: malformed row (fewer than three cells, an empty ID, or indented): {b!r}" for b in bad)
        row_ids = {cells[0] for cells in rows}
        for token in sorted(set(ID_TOKEN.findall(_strip_markup(text))) - row_ids):
            findings.append(f"{rel}: {token} appears outside the ID column of a row")
        for rid, statement, gate in rows:
            if not ID_RE.match(rid):
                findings.append(f"{rel} {rid!r}: the ID does not match SH[DFWCKNTAG]-NNN")
            elif rid in seen:
                findings.append(f"{rel} {rid}: duplicate ID (first in {seen[rid]})")
            else:
                seen[rid] = rel
            if "SHALL" not in statement:
                findings.append(f"{rel} {rid}: the statement has no SHALL")
            if state == "planned":
                planned += 1
                if not refs(gate):
                    findings.append(f"{rel} {rid}: the planned gate names no file ({gate[:80]!r})")
                continue
            live += 1
            findings.extend(gate_findings(rel, rid, gate))
        if not rows:
            findings.append(f"{rel}: no requirement rows")
        if state == "planned":
            pending.append(area)
    if findings:
        print("SDD CHECK FAILED:")
        for f in findings:
            print(f"  - {f}")
        return 1
    note = f"; superseded, not checked: {', '.join(skipped)}" if skipped else ""
    note += f"; {planned} planned requirements, gates not yet built: {', '.join(pending)}" if pending else ""
    print(f"check_sdd: OK, {live} live requirements with real gates{note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
