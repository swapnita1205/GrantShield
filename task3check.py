#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Tuple


ROOT = Path(__file__).resolve().parent
PORTFOLIO_PATH = ROOT / "data" / "portfolio.json"


def parse_date(raw: str) -> date | None:
    try:
        return date.fromisoformat(raw)
    except Exception:
        return None


def classify_score(total: float) -> str:
    if 0 <= total < 3:
        return "low"
    if 3 <= total < 6:
        return "medium"
    if 6 <= total < 8:
        return "high"
    if 8 <= total <= 10:
        return "critical"
    return "invalid"


def validate_record_shape(idx: int, row: Dict[str, Any], errors: List[str]) -> None:
    required_top = ["grant", "audit", "sam", "crustdata", "risk", "timeline"]
    for key in required_top:
        if key not in row:
            errors.append(f"Record {idx}: missing top-level key `{key}`")

    # Backward-compatible alias expected in Task 3 wording.
    if "audits" not in row:
        errors.append(f"Record {idx}: missing `audits` alias")
    if "risk_score" not in row:
        errors.append(f"Record {idx}: missing `risk_score` alias")

    # Evidence from all 4 sources populated.
    if not isinstance(row.get("grant"), dict):
        errors.append(f"Record {idx}: `grant` is not an object")
    if not isinstance(row.get("audit"), dict):
        errors.append(f"Record {idx}: `audit` is not an object")
    if not isinstance(row.get("sam"), dict):
        errors.append(f"Record {idx}: `sam` is not an object")
    if not isinstance(row.get("crustdata"), dict):
        errors.append(f"Record {idx}: `crustdata` is not an object")

    findings = row.get("audit", {}).get("findings")
    if not isinstance(findings, list) or len(findings) == 0:
        errors.append(f"Record {idx}: audit findings are empty")

    signals = row.get("risk", {}).get("signals")
    if not isinstance(signals, list) or len(signals) == 0:
        errors.append(f"Record {idx}: risk signals are empty")

    # Timeline 5-8 chronological events.
    timeline = row.get("timeline")
    if not isinstance(timeline, list):
        errors.append(f"Record {idx}: timeline is not a list")
        return
    if not (5 <= len(timeline) <= 8):
        errors.append(f"Record {idx}: timeline has {len(timeline)} events (expected 5-8)")
        return
    parsed_dates: List[date] = []
    for event_idx, ev in enumerate(timeline):
        if not isinstance(ev, dict):
            errors.append(f"Record {idx}: timeline event {event_idx} is not an object")
            continue
        d = parse_date(str(ev.get("date", "")))
        if d is None:
            errors.append(f"Record {idx}: timeline event {event_idx} has invalid date `{ev.get('date')}`")
        else:
            parsed_dates.append(d)
    if parsed_dates and parsed_dates != sorted(parsed_dates):
        errors.append(f"Record {idx}: timeline dates are not chronological")


def validate_sunrise(rows: List[Dict[str, Any]], errors: List[str]) -> None:
    sunrise = None
    for row in rows:
        grant = row.get("grant", {})
        if grant.get("recipient_name") == "Sunrise Community Health Inc.":
            sunrise = row
            break
    if sunrise is None:
        errors.append("Sunrise case not found by recipient_name.")
        return

    grant = sunrise.get("grant", {})
    audit = sunrise.get("audit", {})
    sam = sunrise.get("sam", {})
    crust = sunrise.get("crustdata", {})
    risk = sunrise.get("risk", {})

    expected_pairs = [
        ("grant.city", grant.get("city"), "Greeley"),
        ("grant.state", grant.get("state"), "CO"),
        ("grant.recipient_uei", grant.get("recipient_uei"), "J4KNMH7E2XL3"),
        ("grant.award_amount", grant.get("award_amount"), 3800000),
        ("grant.burn_rate_pct", float(grant.get("burn_rate_pct", -1)), 91.0),
        ("sam.debt_amount", sam.get("debt_amount"), 142000),
        ("crustdata.headcount_qoq_pct", float(crust.get("headcount_qoq_pct", 0)), -34.0),
        ("crustdata.leadership_vacancy", crust.get("leadership_vacancy"), True),
        ("risk.total", float(risk.get("total", -1)), 9.2),
    ]
    for label, actual, expected in expected_pairs:
        if actual != expected:
            errors.append(f"Sunrise mismatch {label}: got {actual!r}, expected {expected!r}")

    audit_years = sorted(audit.get("audit_years", []))
    if audit_years != [2022, 2023, 2024]:
        errors.append(f"Sunrise audit_years mismatch: got {audit_years}, expected [2022, 2023, 2024]")

    findings = audit.get("findings", [])
    mw_years = sorted([f.get("year") for f in findings if f.get("is_material_weakness")])
    if mw_years != [2022, 2023, 2024]:
        errors.append(
            f"Sunrise must have material weaknesses in 2022-2024. Got years: {mw_years}"
        )

    pcc_findings = [f for f in findings if f.get("type_requirement") == "Personnel Cost Controls"]
    if len(pcc_findings) < 3:
        errors.append("Sunrise must include 3 personnel cost control findings.")

    questioned_total = sum(max(0, int(f.get("questioned_costs_amount", 0))) for f in findings)
    if questioned_total != 287000:
        errors.append(f"Sunrise questioned costs mismatch: got {questioned_total}, expected 287000")

    # Sunrise is highest risk in file.
    sunrise_total = float(risk.get("total", -1))
    highest = max(float(r.get("risk", {}).get("total", -1)) for r in rows)
    if sunrise_total != highest:
        errors.append(f"Sunrise is not highest risk. sunrise={sunrise_total}, highest={highest}")


def main() -> int:
    errors: List[str] = []

    if not PORTFOLIO_PATH.exists():
        print("TASK 3 CHECK: FAIL")
        print("- `data/portfolio.json` does not exist.")
        return 1

    try:
        rows = json.loads(PORTFOLIO_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        print("TASK 3 CHECK: FAIL")
        print(f"- Could not parse JSON: {exc}")
        return 1

    if not isinstance(rows, list):
        errors.append("Top-level JSON value must be an array.")
        rows = []

    if len(rows) != 73:
        errors.append(f"Expected 73 records, found {len(rows)}.")

    distribution = {"low": 0, "medium": 0, "high": 0, "critical": 0, "invalid": 0}

    for idx, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            errors.append(f"Record {idx}: not an object")
            continue
        validate_record_shape(idx, row, errors)
        total = row.get("risk", {}).get("total")
        if not isinstance(total, (int, float)):
            errors.append(f"Record {idx}: risk.total is not numeric")
            continue
        bucket = classify_score(float(total))
        distribution[bucket] += 1

    expected_distribution = {"low": 44, "medium": 18, "high": 8, "critical": 3}
    for k, expected in expected_distribution.items():
        if distribution[k] != expected:
            errors.append(
                f"Distribution mismatch for {k}: got {distribution[k]}, expected {expected}"
            )
    if distribution["invalid"] > 0:
        errors.append(f"Found {distribution['invalid']} scores outside 0-10 bounds.")

    if rows:
        validate_sunrise(rows, errors)

    if errors:
        print("TASK 3 CHECK: FAIL")
        for err in errors:
            print(f"- {err}")
        return 1

    print("TASK 3 CHECK: PASS")
    print("- `data/portfolio.json` loads and has 73 records.")
    print("- Distribution matches: low=44, medium=18, high=8, critical=3.")
    print("- Sunrise case is present with required top-case evidence and highest risk score (9.2).")
    print("- All records include populated grant/audit/sam/crustdata evidence and 5-8 chronological timeline events.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
