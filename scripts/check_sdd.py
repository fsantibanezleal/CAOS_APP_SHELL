#!/usr/bin/env python3
"""The SDD gate (ADR-0075): the design document exists and every requirement names a gate that is real.

Ported from CAOS_PRODUCT_TEMPLATE's scripts/check_sdd.py, fitted to the shell's format and its test layout.

Checks, in increasing strength:

1. ``docs/design/SDD.md`` exists with the ten sections, in order.
2. Every requirements file (``docs/design/features/<area>/requirements.md``) has ``# Requirements: <area>``, a
   ``Status:`` line (live, planned or superseded) and a ``| ID | Requirement | Gate |`` table.
3. Every row has an ID matching ``SH[DFWCKNTAG]-NNN`` (unique across all files), a statement with SHALL and a gate.
4. **The named gate exists.** A gate cell names, in backticks, one or more of:
   ``test/<file>::<name>`` or ``e2e/<file>::<name>`` (the name is the first string argument of ``test(``, ``it(``
   or ``describe(`` in that file), ``test/gate-selftest.mjs::<plant id>`` (the id appears as ``id: '<plant id>'``),
   or a plain file path that exists.

Check 4 is the one that matters: a requirement can name ``test/nothing.test.ts::imaginary`` and pass checks 1 to 3
while verifying nothing, which is the failure the rule exists for.

``Status: superseded`` skips a file (listed). ``Status: planned`` applies checks 1 to 3 and requires a file reference
that need not exist yet (counted apart, never reported as a real gate).

Standard library only; exit 1 on any finding. Usage: ``python scripts/check_sdd.py [repo_root]``.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
SDD = ROOT / "docs" / "design" / "SDD.md"
FEATURES = ROOT / "docs" / "design" / "features"

SECTIONS = (
    "Problem and non-goals", "Dimensioning", "Technology and versions", "Contracts", "Components",
    "Degradation and dependency states", "Verification", "Versions and adoption", "Risks", "ADR fit",
)
ID_RE = re.compile(r"^SH[DFWCKNTAG]-\d{3}$")
TICKED = re.compile(r"`([^`]+)`")
FILE_LIKE = re.compile(r"^[\w./-]+\.(py|ts|tsx|mjs|js|json|md|yml|yaml|css)(::[^`]+)?$")
HEADER = re.compile(r"^#\s+Requirements:\s*\S", re.M)
STATUS = re.compile(r"^Status:\s*(live|planned|superseded)\s*$", re.M | re.I)
SELFTEST = "test/gate-selftest.mjs"


def sdd_findings() -> list[str]:
    if not SDD.is_file():
        return [f"{SDD.relative_to(ROOT).as_posix()} is missing"]
    headings = [re.sub(r"^\d+[.)]?\s*", "", ln[3:].strip()).lower()
                for ln in SDD.read_text(encoding="utf-8").splitlines() if ln.startswith("## ")]
    out: list[str] = []
    last = -1
    for name in SECTIONS:
        if name.lower() not in headings:
            out.append(f"SDD.md has no section for {name!r}")
            continue
        at = headings.index(name.lower())
        if at < last:
            out.append(f"SDD.md section {name!r} is out of order")
        last = max(last, at)
    return out


def test_defined(path: Path, name: str) -> bool:
    text = path.read_text(encoding="utf-8")
    # a name that exists only in a comment is not a test: drop block comments and whole-line // comments
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"^[ \t]*//.*$", "", text, flags=re.M)
    if path.as_posix().endswith(SELFTEST):
        return re.search(rf"""\bid:\s*(['"`]){re.escape(name)}\1""", text) is not None
    # the name is the first string argument of test(, it( or describe( (test.skip( and the like count)
    return re.search(rf"""\b(?:test|it|describe)(?:\.\w+)*\(\s*(['"`]){re.escape(name)}\1""", text) is not None


def refs(gate: str) -> list[str]:
    return [t.strip() for t in TICKED.findall(gate) if FILE_LIKE.match(t.strip())]


def gate_findings(rel: str, rid: str, gate: str) -> list[str]:
    named = refs(gate)
    if not named:
        return [f"{rel} {rid}: the gate names no file ({gate.strip()[:80]!r})"]
    out: list[str] = []
    for target in named:
        path_part, _, name = target.partition("::")
        path = ROOT / path_part
        if not path.is_file():
            out.append(f"{rel} {rid}: names {path_part!r}, which does not exist")
        elif name and not test_defined(path, name):
            out.append(f"{rel} {rid}: {path_part} defines no test or plant {name!r}")
    return out


def main() -> int:
    findings = sdd_findings()
    live = planned = 0
    skipped: list[str] = []
    pending: list[str] = []
    seen: dict[str, str] = {}
    files = sorted(FEATURES.glob("*/requirements.md"))
    if not files:
        findings.append("docs/design/features/ has no <area>/requirements.md")
    for req in files:
        rel = req.relative_to(ROOT).as_posix()
        text = req.read_text(encoding="utf-8")
        head = "\n".join(text.splitlines()[:6])
        if not HEADER.search(head):
            findings.append(f"{rel}: the first lines lack '# Requirements: <area>'")
        status = STATUS.search(head)
        if not status:
            findings.append(f"{rel}: the first lines lack 'Status: live', 'planned' or 'superseded'")
            continue
        state = status.group(1).lower()
        if state == "superseded":
            skipped.append(req.parent.name)
            continue
        if not re.search(r"^\|\s*ID\s*\|\s*Requirement\s*\|\s*Gate\s*\|", text, re.M):
            findings.append(f"{rel}: no '| ID | Requirement | Gate |' table")
        rows = 0
        for line in text.splitlines():
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|", 2)]
            if len(cells) < 3 or cells[0] == "ID" or set(cells[0]) <= set("-: "):
                continue
            rid, statement, gate = cells
            rows += 1
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
        if rows == 0:
            findings.append(f"{rel}: no requirement rows")
        if state == "planned":
            pending.append(req.parent.name)
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
