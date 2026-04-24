#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, List, Tuple


ROOT = Path(__file__).resolve().parent
RISK_FILE = ROOT / "lib" / "risk-scoring.ts"
TYPES_FILE = ROOT / "lib" / "types.ts"


def run(cmd: List[str], cwd: Path) -> Tuple[int, str]:
    proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    return proc.returncode, (proc.stdout + proc.stderr).strip()


def compile_risk_files() -> Tuple[bool, str]:
    code, output = run(
        [
            "node",
            "node_modules/typescript/bin/tsc",
            "--noEmit",
            "--strict",
            str(TYPES_FILE.relative_to(ROOT)),
            str(RISK_FILE.relative_to(ROOT)),
        ],
        ROOT,
    )
    return code == 0, output


def static_contract_checks(content: str) -> List[str]:
    errs: List[str] = []

    sig_re = re.compile(
        r"export\s+function\s+computeRiskScore\s*\(\s*"
        r"grant\s*:\s*Grant\s*,\s*"
        r"audits\s*:\s*AuditData\s*,\s*"
        r"sam\s*:\s*SamEntity\s*,\s*"
        r"crustdata\s*:\s*CrustdataProfile\s*,?\s*"
        r"\)\s*:\s*RiskScore",
        re.DOTALL,
    )
    if not sig_re.search(content):
        errs.append("`computeRiskScore(grant, audits, sam, crustdata): RiskScore` signature mismatch.")

    # Threshold/model sanity checks
    required_snippets = [
        "burn_time_ratio",
        "> 1.3",
        "< 0.5",
        "modification_count >= 3",
        "employee_reviews_rating < 3",
        "daysToExpiry",
        "<= 90",
        "Math.min(10",
        'return "low"',
        'return "medium"',
        'return "high"',
        'return "critical"',
    ]
    for snippet in required_snippets:
        if snippet not in content:
            errs.append(f"Model snippet missing in `lib/risk-scoring.ts`: {snippet}")

    forbidden_side_effect_markers = ["console.", "fetch(", "process.", "supabase", "fs."]
    for marker in forbidden_side_effect_markers:
        if marker in content:
            errs.append(f"Potential non-pure side-effect marker found: `{marker}`")

    return errs


def run_runtime_checks() -> Tuple[List[str], Any]:
    errs: List[str] = []
    result_payload: Any = None

    with tempfile.TemporaryDirectory(prefix="riskcheck-") as temp_dir:
        out_dir = Path(temp_dir)
        code, output = run(
            [
                "node",
                str((ROOT / "node_modules/typescript/bin/tsc").resolve()),
                str(TYPES_FILE.resolve()),
                str(RISK_FILE.resolve()),
                "--module",
                "commonjs",
                "--target",
                "es2020",
                "--outDir",
                str(out_dir),
            ],
            ROOT,
        )
        if code != 0:
            errs.append(f"Failed to transpile risk files for runtime checks:\n{output}")
            return errs, result_payload

        node_script = f"""
const {{ computeRiskScore }} = require({json.dumps(str((out_dir / "risk-scoring.js").resolve()))});

const sunriseGrant = {{
  award_id: "AWD-SUNRISE-001",
  recipient_name: "Sunrise Community Health",
  recipient_uei: "UEI-SUNRISE",
  cfda_number: "93.224",
  award_amount: 1250000,
  total_outlays: 1137500,
  start_date: "2024-01-01",
  end_date: "2026-12-31",
  state: "TX",
  city: "Austin",
  modification_count: 4,
  burn_rate_pct: 91,
  time_elapsed_pct: 95,
  burn_time_ratio: 0.96
}};

const sunriseAudits = {{
  auditee_uei: "UEI-SUNRISE",
  audit_years: [2022, 2023, 2024],
  audit_opinion: "unmodified",
  findings: [
    {{
      year: 2022,
      type_requirement: "Financial Reporting",
      is_material_weakness: true,
      is_significant_deficiency: false,
      is_questioned_costs: false,
      questioned_costs_amount: 0,
      is_repeated: true
    }},
    {{
      year: 2023,
      type_requirement: "Financial Reporting",
      is_material_weakness: true,
      is_significant_deficiency: false,
      is_questioned_costs: false,
      questioned_costs_amount: 0,
      is_repeated: true
    }},
    {{
      year: 2024,
      type_requirement: "Financial Reporting",
      is_material_weakness: true,
      is_significant_deficiency: false,
      is_questioned_costs: false,
      questioned_costs_amount: 0,
      is_repeated: true
    }}
  ],
  has_going_concern: false,
  has_material_noncompliance: false
}};

const sunriseSam = {{
  uei: "UEI-SUNRISE",
  legal_name: "Sunrise Community Health",
  registration_status: "Active",
  expiration_date: "2030-12-31",
  has_delinquent_debt: true,
  debt_amount: 142000,
  has_exclusion: false,
  exclusion_type: ""
}};

const sunriseCrust = {{
  matched_uei: "UEI-SUNRISE",
  headcount: 126,
  headcount_qoq_pct: -34,
  ceo_name: "N/A",
  employee_reviews_rating: 3.4,
  recent_review_snippets: [],
  job_postings: 2,
  leadership_vacancy: true
}};

const sunrise = computeRiskScore(sunriseGrant, sunriseAudits, sunriseSam, sunriseCrust);

const stress = computeRiskScore(
  {{ ...sunriseGrant, burn_time_ratio: 1.8, modification_count: 9 }},
  {{
    ...sunriseAudits,
    audit_opinion: "adverse",
    findings: sunriseAudits.findings.map(f => ({{ ...f, is_significant_deficiency: true, is_questioned_costs: true, questioned_costs_amount: 100000 }}))
  }},
  {{ ...sunriseSam, has_exclusion: true, exclusion_type: "Procurement Fraud", expiration_date: "2026-05-01" }},
  {{ ...sunriseCrust, employee_reviews_rating: 2.5 }}
);

console.log(JSON.stringify({{ sunrise, stress }}));
"""

        code, output = run(["node", "-e", node_script], ROOT)
        if code != 0:
            errs.append(f"Runtime execution failed:\n{output}")
            return errs, result_payload

        try:
            result_payload = json.loads(output)
        except json.JSONDecodeError as exc:
            errs.append(f"Could not parse runtime output as JSON: {exc}\nOutput:\n{output}")
            return errs, result_payload

    sunrise = result_payload["sunrise"]
    stress = result_payload["stress"]

    total = sunrise.get("total")
    level = sunrise.get("level")
    signals = sunrise.get("signals", [])
    unique_sources = {s.get("source") for s in signals if isinstance(s, dict)}

    if not isinstance(total, (int, float)) or not (9.0 <= float(total) <= 9.5):
        errs.append(f"Sunrise score out of expected range 9.0-9.5. Got: {total}")
    if level != "critical":
        errs.append(f"Sunrise level should be 'critical'. Got: {level}")
    if len(signals) < 6:
        errs.append(f"Sunrise should have at least 6 populated signals. Got: {len(signals)}")
    if len(unique_sources) < 3:
        errs.append(
            f"Sunrise signals should come from different sources (>=3 source systems). Got: {sorted(unique_sources)}"
        )

    stress_total = stress.get("total")
    if not isinstance(stress_total, (int, float)) or float(stress_total) > 10:
        errs.append(f"Score cap failed in stress case; expected <= 10, got: {stress_total}")

    return errs, result_payload


def main() -> int:
    errors: List[str] = []

    if not RISK_FILE.exists():
        print("FAIL: `lib/risk-scoring.ts` does not exist.")
        return 1

    content = RISK_FILE.read_text(encoding="utf-8")
    errors.extend(static_contract_checks(content))

    compile_ok, compile_output = compile_risk_files()
    if not compile_ok:
        errors.append(f"TypeScript compile failed:\n{compile_output}")

    runtime_errors, payload = run_runtime_checks()
    errors.extend(runtime_errors)

    if errors:
        print("TASK 2 CHECK: FAIL")
        for err in errors:
            print(f"- {err}")
        return 1

    sunrise = payload["sunrise"]
    print("TASK 2 CHECK: PASS")
    print("- `computeRiskScore` signature and TypeScript compile checks passed.")
    print(
        f"- Sunrise scenario -> total={sunrise['total']}, level={sunrise['level']}, "
        f"signals={len(sunrise['signals'])}."
    )
    print("- Score cap behavior verified (stress case total <= 10).")
    print("- Uses synthetic SAM/Crustdata objects; no live API dependency.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
