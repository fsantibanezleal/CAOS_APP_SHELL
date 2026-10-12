"""Unit tests of scripts/check_sdd.py (ADR-0075). Each case builds a throwaway tree and runs the checker on it.

Run: python -m unittest scripts/test_check_sdd.py
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

CHECKER = Path(__file__).resolve().parent / "check_sdd.py"
SECTIONS = (
    "Problem and non-goals", "Dimensioning", "Technology and versions", "Contracts", "Components",
    "Degradation and dependency states", "Verification", "Versions and adoption", "Risks", "ADR fit",
)
UNIT_TEST = "import test from 'node:test';\ntest('keeps the focus inside the drawer', () => {});\n"
E2E_TEST = 'describe("the sidebar collapses", () => {});\n'
SELFTEST = "const plants = [\n  { id: 'g15-overflow', plant: 1 },\n];\n"


def row(rid: str, statement: str, gate: str) -> str:
    return f"| {rid} | {statement} | {gate} |"


class Tree:
    """A throwaway repository tree under a temp dir."""

    def __init__(self, status: str = "live", rows: list[str] | None = None, sections: tuple[str, ...] = SECTIONS) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.write("docs/design/SDD.md", "# SDD\n\n" + "".join(f"## {s}\n\ntext\n\n" for s in sections))
        self.write("test/focus.test.ts", UNIT_TEST)
        self.write("e2e/sidebar.test.ts", E2E_TEST)
        self.write("test/gate-selftest.mjs", SELFTEST)
        default = [row("SHF-001", "The drawer SHALL trap focus.", "`test/focus.test.ts::keeps the focus inside the drawer`")]
        self.write_requirements("drawer", status, default if rows is None else rows)

    def write(self, rel: str, text: str) -> None:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def write_requirements(self, area: str, status: str, rows: list[str]) -> None:
        body = f"# Requirements: {area}\n\nStatus: {status}\n\n| ID | Requirement | Gate |\n|---|---|---|\n" + "\n".join(rows) + "\n"
        self.write(f"docs/design/features/{area}/requirements.md", body)

    def run(self) -> tuple[int, str]:
        proc = subprocess.run([sys.executable, str(CHECKER), str(self.root)], capture_output=True, text=True, encoding="utf-8")
        return proc.returncode, proc.stdout + proc.stderr

    def close(self) -> None:
        self._tmp.cleanup()


class CheckSdd(unittest.TestCase):
    def tree(self, **kw) -> Tree:
        t = Tree(**kw)
        self.addCleanup(t.close)
        return t

    def test_complete_tree_passes(self) -> None:
        t = self.tree(rows=[
            row("SHF-001", "The drawer SHALL trap focus.", "`test/focus.test.ts::keeps the focus inside the drawer`"),
            row("SHW-002", "The sidebar SHALL collapse.", "`e2e/sidebar.test.ts::the sidebar collapses`"),
            row("SHG-003", "The gate SHALL flag overflow.", "`test/gate-selftest.mjs::g15-overflow`"),
            row("SHK-004", "The tree SHALL exist.", "`test/focus.test.ts`"),
        ])
        code, out = t.run()
        self.assertEqual(code, 0, out)
        self.assertIn("check_sdd: OK, 4 live requirements with real gates", out)

    def test_missing_sdd_fails(self) -> None:
        t = self.tree()
        (t.root / "docs/design/SDD.md").unlink()
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("SDD.md is missing", out)

    def test_missing_section_fails(self) -> None:
        t = self.tree(sections=tuple(s for s in SECTIONS if s != "Dimensioning"))
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("Dimensioning", out)

    def test_missing_shall_fails(self) -> None:
        t = self.tree(rows=[row("SHF-001", "The drawer traps focus.", "`test/focus.test.ts::keeps the focus inside the drawer`")])
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("SHALL", out)

    def test_duplicate_id_fails(self) -> None:
        gate = "`test/focus.test.ts::keeps the focus inside the drawer`"
        t = self.tree(rows=[row("SHF-001", "A SHALL.", gate), row("SHF-001", "B SHALL.", gate)])
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("duplicate", out)

    def test_missing_file_fails(self) -> None:
        t = self.tree(rows=[row("SHF-001", "A SHALL.", "`test/nothing.test.ts::anything`")])
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("does not exist", out)

    def test_missing_test_name_fails(self) -> None:
        t = self.tree(rows=[row("SHF-001", "A SHALL.", "`test/focus.test.ts::an imaginary test`")])
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("an imaginary test", out)

    def test_plant_id_present_passes_and_absent_fails(self) -> None:
        ok = self.tree(rows=[row("SHG-001", "A SHALL.", "`test/gate-selftest.mjs::g15-overflow`")])
        code, out = ok.run()
        self.assertEqual(code, 0, out)
        bad = self.tree(rows=[row("SHG-001", "A SHALL.", "`test/gate-selftest.mjs::g99-nothing`")])
        code, out = bad.run()
        self.assertEqual(code, 1)
        self.assertIn("g99-nothing", out)

    def test_named_test_in_the_gate_selftest_passes(self) -> None:
        t = self.tree(rows=[row("SHG-001", "A SHALL.", "`test/gate-selftest.mjs::the clean fixture passes`")])
        t.write("test/gate-selftest.mjs", SELFTEST + "test('the clean fixture passes', () => {});\n")
        code, out = t.run()
        self.assertEqual(code, 0, out)
        bad = self.tree(rows=[row("SHG-001", "A SHALL.", "`test/gate-selftest.mjs::a test that is not there`")])
        code, out = bad.run()
        self.assertEqual(code, 1)
        self.assertIn("a test that is not there", out)

    def test_planned_with_missing_file_passes_and_is_counted_apart(self) -> None:
        t = self.tree(status="planned", rows=[row("SHT-001", "A SHALL.", "`test/not-yet.test.ts::later`")])
        code, out = t.run()
        self.assertEqual(code, 0, out)
        self.assertIn("0 live requirements", out)
        self.assertIn("1 planned", out)

    def test_name_only_in_a_comment_fails(self) -> None:
        t = self.tree(rows=[row("SHF-001", "A SHALL.", "`test/focus.test.ts::ghost`")])
        t.write("test/focus.test.ts", "// test('ghost', () => {});\n/* it('ghost', () => {}); */\n")
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("ghost", out)

    def test_name_in_another_file_fails(self) -> None:
        t = self.tree(rows=[row("SHF-001", "A SHALL.", "`test/focus.test.ts::the sidebar collapses`")])
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("the sidebar collapses", out)

    def test_crlf_files_and_several_references_pass(self) -> None:
        gate = "`test/focus.test.ts::keeps the focus inside the drawer` and `e2e/sidebar.test.ts::the sidebar collapses`"
        t = self.tree(rows=[row("SHF-001", "A SHALL.", gate)])
        for rel in ("docs/design/SDD.md", "docs/design/features/drawer/requirements.md", "test/focus.test.ts", "e2e/sidebar.test.ts"):
            path = t.root / rel
            path.write_bytes(path.read_bytes().replace(b"\n", b"\r\n"))
        code, out = t.run()
        self.assertEqual(code, 0, out)

    def test_nested_describe_and_backtick_names_pass(self) -> None:
        t = self.tree(rows=[row("SHF-001", "A SHALL.", "`test/focus.test.ts::inner` `test/focus.test.ts::tick name`")])
        t.write("test/focus.test.ts", "describe('outer', () => {\n  describe('inner', () => {\n    it(`tick name`, () => {});\n  });\n});\n")
        code, out = t.run()
        self.assertEqual(code, 0, out)

    def test_missing_requirements_folder_fails(self) -> None:
        t = self.tree()
        (t.root / "docs/design/features/drawer/requirements.md").unlink()
        code, out = t.run()
        self.assertEqual(code, 1)
        self.assertIn("requirements.md", out)

    def test_superseded_file_is_skipped(self) -> None:
        t = self.tree(status="superseded", rows=[row("SHF-001", "no shall", "nothing")])
        code, out = t.run()
        self.assertEqual(code, 0, out)
        self.assertIn("superseded", out)


if __name__ == "__main__":
    unittest.main()
