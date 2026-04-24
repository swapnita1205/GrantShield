#!/usr/bin/env python3
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Set


ROOT = Path(__file__).resolve().parent
TYPES_FILE = ROOT / "lib" / "types.ts"

REQUIRED_INTERFACES: Dict[str, Set[str]] = {
    "Grant": {
        "award_id",
        "recipient_name",
        "recipient_uei",
        "cfda_number",
        "award_amount",
        "total_outlays",
        "start_date",
        "end_date",
        "state",
        "city",
        "modification_count",
        "burn_rate_pct",
        "time_elapsed_pct",
        "burn_time_ratio",
    },
    "AuditFinding": {
        "year",
        "type_requirement",
        "is_material_weakness",
        "is_significant_deficiency",
        "is_questioned_costs",
        "questioned_costs_amount",
        "is_repeated",
    },
    "AuditData": {
        "auditee_uei",
        "audit_years",
        "audit_opinion",
        "findings",
        "has_going_concern",
        "has_material_noncompliance",
    },
    "SamEntity": {
        "uei",
        "legal_name",
        "registration_status",
        "expiration_date",
        "has_delinquent_debt",
        "debt_amount",
        "has_exclusion",
        "exclusion_type",
    },
    "CrustdataProfile": {
        "matched_uei",
        "headcount",
        "headcount_qoq_pct",
        "ceo_name",
        "employee_reviews_rating",
        "recent_review_snippets",
        "job_postings",
        "leadership_vacancy",
    },
    "RiskSignal": {"source", "severity", "label", "detail"},
    "RiskScore": {"total", "level", "signals"},
    "TimelineEvent": {"date", "source", "severity", "description"},
    "PortfolioGrant": {"grant", "audit", "sam", "crustdata", "risk", "timeline"},
    "AgentStep": {"step_number", "source", "status", "label", "detail", "timestamp"},
}


def parse_interface_fields(content: str, interface_name: str) -> Set[str]:
    start = re.search(rf"export\s+interface\s+{re.escape(interface_name)}\s*\{{", content)
    if not start:
        return set()

    idx = start.end()
    depth = 1
    body_chars: List[str] = []
    while idx < len(content) and depth > 0:
        ch = content[idx]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                break
        body_chars.append(ch)
        idx += 1

    body = "".join(body_chars)
    fields = set(re.findall(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:", body, re.MULTILINE))
    return fields


def run_tsc_compile_check() -> tuple[bool, str]:
    cmd = [
        "node",
        "node_modules/typescript/bin/tsc",
        "--noEmit",
        "--strict",
        str(TYPES_FILE.relative_to(ROOT)),
    ]
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    output = (proc.stdout + proc.stderr).strip()
    return proc.returncode == 0, output


def find_non_types_definitions(interface_names: Set[str]) -> List[str]:
    offenders: List[str] = []
    for path in ROOT.rglob("*.ts"):
        if "node_modules" in path.parts:
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel == "lib/types.ts":
            continue
        text = path.read_text(encoding="utf-8")
        for interface_name in interface_names:
            if re.search(rf"export\s+interface\s+{re.escape(interface_name)}\b", text):
                offenders.append(rel)
                break
    return offenders


def find_type_consumers() -> List[str]:
    consumers: List[str] = []
    for path in ROOT.rglob("*.ts"):
        if "node_modules" in path.parts:
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel == "lib/types.ts":
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(r'from\s+["\'](\.\.?/)+types["\']', text) or re.search(
            r'from\s+["\'](?:@/)?lib/types["\']', text
        ):
            consumers.append(rel)
    return sorted(consumers)


def main() -> int:
    errors: List[str] = []

    if not TYPES_FILE.exists():
        print("FAIL: `lib/types.ts` does not exist.")
        return 1

    content = TYPES_FILE.read_text(encoding="utf-8")

    # Check all required interfaces and required fields.
    for iface, expected_fields in REQUIRED_INTERFACES.items():
        fields = parse_interface_fields(content, iface)
        if not fields:
            errors.append(f"Missing interface: {iface}")
            continue
        missing = sorted(expected_fields - fields)
        if missing:
            errors.append(f"{iface} missing fields: {', '.join(missing)}")

    # Check TypeScript compile for the single source-of-truth file.
    compile_ok, compile_output = run_tsc_compile_check()
    if not compile_ok:
        errors.append(f"`lib/types.ts` failed strict compile:\n{compile_output}")

    # Check interface definitions are centralized in lib/types.ts.
    offenders = find_non_types_definitions(set(REQUIRED_INTERFACES.keys()))
    if offenders:
        errors.append(
            "Required interfaces are exported outside `lib/types.ts`: " + ", ".join(offenders)
        )

    # Check at least one other file imports shared types.
    consumers = find_type_consumers()
    if not consumers:
        errors.append("No consumer files import from `lib/types.ts`.")

    if errors:
        print("TASK 1 CHECK: FAIL")
        for err in errors:
            print(f"- {err}")
        return 1

    print("TASK 1 CHECK: PASS")
    print("- All required interfaces and fields are present in `lib/types.ts`.")
    print("- `lib/types.ts` compiles under strict TypeScript checks.")
    print("- Required interfaces are centralized in one file.")
    print(f"- Found type consumers: {', '.join(consumers)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
