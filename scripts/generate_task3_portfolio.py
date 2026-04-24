#!/usr/bin/env python3
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "portfolio.json"


@dataclass(frozen=True)
class Seed:
    idx: int
    name: str
    city: str
    state: str


SEEDS = [
    Seed(1, "Sunrise Community Health Inc.", "Greeley", "CO"),
    Seed(2, "Metro Family Health Center", "Phoenix", "AZ"),
    Seed(3, "Coastal Bend Wellness Clinic", "Corpus Christi", "TX"),
    Seed(4, "North Valley Community Clinic", "Fresno", "CA"),
    Seed(5, "River City Health Partners", "Sacramento", "CA"),
    Seed(6, "Lakeshore Primary Care Network", "Cleveland", "OH"),
    Seed(7, "Blue Ridge Family Medical", "Asheville", "NC"),
    Seed(8, "Golden Plains Health Alliance", "Wichita", "KS"),
    Seed(9, "Southside Neighborhood Health", "Birmingham", "AL"),
    Seed(10, "Delta Community Wellness", "Jackson", "MS"),
    Seed(11, "Pioneer Valley Health Center", "Springfield", "MA"),
    Seed(12, "Great Lakes Care Collective", "Detroit", "MI"),
    Seed(13, "Capital Region Family Health", "Albany", "NY"),
    Seed(14, "Gateway Care Services", "St. Louis", "MO"),
    Seed(15, "Liberty Health Collaborative", "Philadelphia", "PA"),
    Seed(16, "Palmetto Community Clinic", "Columbia", "SC"),
    Seed(17, "Evergreen Health Access", "Portland", "OR"),
    Seed(18, "Desert Bloom Health Center", "Tucson", "AZ"),
    Seed(19, "Redwood Community Medical", "Santa Rosa", "CA"),
    Seed(20, "Central Plains Health Partners", "Oklahoma City", "OK"),
    Seed(21, "Harborview Family Clinic", "Baltimore", "MD"),
    Seed(22, "Mountain View Health Services", "Boise", "ID"),
    Seed(23, "Heartland Neighborhood Health", "Omaha", "NE"),
    Seed(24, "Piedmont Care Alliance", "Greensboro", "NC"),
    Seed(25, "Sunset Valley Health Group", "Reno", "NV"),
    Seed(26, "Prairie Hope Health Center", "Des Moines", "IA"),
    Seed(27, "Bayfront Community Wellness", "Tampa", "FL"),
    Seed(28, "Northeast Family Health Network", "Boston", "MA"),
    Seed(29, "South Coast Care Collective", "Savannah", "GA"),
    Seed(30, "Frontier Plains Medical", "Cheyenne", "WY"),
    Seed(31, "Maple Grove Health Partners", "Madison", "WI"),
    Seed(32, "Eastside Community Clinic", "Richmond", "VA"),
    Seed(33, "Skyline Family Care", "Denver", "CO"),
    Seed(34, "Waterfront Health Associates", "Norfolk", "VA"),
    Seed(35, "Willow Creek Health Access", "Little Rock", "AR"),
    Seed(36, "Unity Neighborhood Health", "Milwaukee", "WI"),
    Seed(37, "Crossroads Community Wellness", "Louisville", "KY"),
    Seed(38, "Granite State Family Health", "Manchester", "NH"),
    Seed(39, "Lakeview Integrated Care", "Minneapolis", "MN"),
    Seed(40, "Pine Hill Community Health", "Augusta", "ME"),
    Seed(41, "Riverbend Family Clinic", "Cincinnati", "OH"),
    Seed(42, "Seaside Health Resources", "Wilmington", "NC"),
    Seed(43, "Canyon Ridge Medical Center", "Albuquerque", "NM"),
    Seed(44, "Crescent City Health Network", "New Orleans", "LA"),
    Seed(45, "Midtown Community Medical", "Indianapolis", "IN"),
    Seed(46, "West Harbor Family Health", "Seattle", "WA"),
    Seed(47, "TriCounty Health Collaborative", "Chattanooga", "TN"),
    Seed(48, "Heritage Community Care", "Providence", "RI"),
    Seed(49, "Summit Valley Health", "Salt Lake City", "UT"),
    Seed(50, "Neighborhood Hope Clinic", "Columbus", "OH"),
    Seed(51, "Bridgeway Primary Health", "Pittsburgh", "PA"),
    Seed(52, "Oak Meadow Health Center", "Nashville", "TN"),
    Seed(53, "Regional Wellness Consortium", "Buffalo", "NY"),
    Seed(54, "Northshore Family Clinic", "Chicago", "IL"),
    Seed(55, "South Plains Care Network", "Lubbock", "TX"),
    Seed(56, "Horizon Community Health", "Spokane", "WA"),
    Seed(57, "Valley Bridge Health Services", "Bakersfield", "CA"),
    Seed(58, "Keystone Health Collaborative", "Harrisburg", "PA"),
    Seed(59, "WellSpring Family Medical", "Kansas City", "MO"),
    Seed(60, "Urban Core Health Access", "Newark", "NJ"),
    Seed(61, "Harmony Community Clinic", "Dayton", "OH"),
    Seed(62, "Pioneer Care Alliance", "Billings", "MT"),
    Seed(63, "Anchor Point Health Center", "Anchorage", "AK"),
    Seed(64, "Mesa Verde Family Health", "Santa Fe", "NM"),
    Seed(65, "Commonwealth Health Partners", "Lexington", "KY"),
    Seed(66, "Mercy Plains Community Care", "Sioux Falls", "SD"),
    Seed(67, "Harbor Light Health Services", "Portland", "ME"),
    Seed(68, "Civic Health Initiative", "Toledo", "OH"),
    Seed(69, "Riverfront Community Medical", "Memphis", "TN"),
    Seed(70, "Lighthouse Family Health", "Mobile", "AL"),
    Seed(71, "Silver State Health Network", "Las Vegas", "NV"),
    Seed(72, "Pioneer Coast Care Center", "San Diego", "CA"),
    Seed(73, "Greenway Neighborhood Health", "Charlotte", "NC"),
]

LOW_SCORES = [
    0.8, 1.1, 1.4, 1.7, 2.0, 2.2, 2.4, 2.6, 2.8, 1.3, 1.6,
    0.9, 2.1, 2.3, 2.7, 1.2, 1.8, 2.5, 2.9, 0.7, 1.5, 2.4,
    2.2, 1.0, 1.9, 2.6, 2.8, 1.4, 1.7, 2.0, 2.3, 2.5, 0.6,
    1.1, 1.3, 1.8, 2.1, 2.7, 2.9, 0.9, 1.6, 2.2, 2.4, 2.8, 2.1,
]
MEDIUM_SCORES = [3.1, 3.4, 3.7, 4.0, 4.3, 4.6, 4.9, 5.2, 5.5, 5.8, 3.3, 3.9, 4.4, 4.8, 5.1, 5.4, 3.6, 4.2]
HIGH_SCORES = [6.1, 6.4, 6.7, 7.0, 7.3, 7.5, 7.7, 7.9]
CRITICAL_SCORES = [8.9, 8.4]


def level_for(total: float) -> str:
    if total < 3:
        return "low"
    if total < 6:
        return "medium"
    if total < 8:
        return "high"
    return "critical"


def make_timeline(seed: Seed, risk_level: str) -> list[dict]:
    return [
        {
            "date": f"2024-0{(seed.idx % 3) + 1}-15",
            "source": "USASpending",
            "severity": "low",
            "description": f"Award profile refreshed for {seed.name}.",
        },
        {
            "date": f"2024-0{(seed.idx % 3) + 3}-20",
            "source": "FAC",
            "severity": "medium" if risk_level in {"medium", "high", "critical"} else "low",
            "description": "FAC filing ingested with updated compliance findings.",
        },
        {
            "date": f"2024-0{(seed.idx % 3) + 5}-12",
            "source": "SAM",
            "severity": "medium" if risk_level in {"high", "critical"} else "low",
            "description": "SAM entity registration and integrity status synchronized.",
        },
        {
            "date": f"2024-0{(seed.idx % 3) + 7}-08",
            "source": "Crustdata",
            "severity": "medium" if risk_level in {"high", "critical"} else "low",
            "description": "External workforce profile and hiring signal refreshed.",
        },
        {
            "date": "2024-12-31",
            "source": "USASpending",
            "severity": risk_level,
            "description": f"Composite risk score computed at {risk_level} level.",
        },
    ]


def make_base_record(seed: Seed, total: float, bucket: str) -> dict:
    level = level_for(total)
    uei = f"UEI{seed.idx:010d}"
    award = 1_000_000 + seed.idx * 35_000
    outlays = round(award * min(0.96, 0.3 + (total / 10.0)), 2)
    elapsed = 65 + (seed.idx % 25)
    burn = round((outlays / award) * 100, 1)
    ratio = round(burn / elapsed, 2)

    findings = [
        {
            "year": 2024,
            "type_requirement": "Allowable Costs",
            "is_material_weakness": bucket in {"high", "critical"} and seed.idx % 2 == 0,
            "is_significant_deficiency": bucket in {"medium", "high", "critical"} and seed.idx % 3 == 0,
            "is_questioned_costs": bucket in {"high", "critical"} and seed.idx % 4 == 0,
            "questioned_costs_amount": 50000 if bucket in {"high", "critical"} and seed.idx % 4 == 0 else 0,
            "is_repeated": bucket in {"high", "critical"} and seed.idx % 5 == 0,
        }
    ]
    if bucket in {"high", "critical"}:
        findings.append(
            {
                "year": 2023,
                "type_requirement": "Procurement",
                "is_material_weakness": seed.idx % 3 == 0,
                "is_significant_deficiency": True,
                "is_questioned_costs": seed.idx % 4 == 0,
                "questioned_costs_amount": 30000 if seed.idx % 4 == 0 else 0,
                "is_repeated": True,
            }
        )

    record = {
        "grant": {
            "award_id": f"HRSA-{seed.idx:05d}",
            "recipient_name": seed.name,
            "recipient_uei": uei,
            "cfda_number": "93.224",
            "award_amount": award,
            "total_outlays": outlays,
            "start_date": "2023-01-01",
            "end_date": "2026-12-31",
            "state": seed.state,
            "city": seed.city,
            "modification_count": 1 + (seed.idx % 4),
            "burn_rate_pct": burn,
            "time_elapsed_pct": elapsed,
            "burn_time_ratio": ratio,
        },
        "audit": {
            "auditee_uei": uei,
            "audit_years": [2023, 2024],
            "audit_opinion": "unmodified" if bucket in {"low", "medium"} else "qualified",
            "findings": findings,
            "has_going_concern": bucket == "critical" and seed.idx % 2 == 0,
            "has_material_noncompliance": bucket in {"high", "critical"} and seed.idx % 2 == 1,
        },
        "audits": None,  # Back-compat alias filled below.
        "sam": {
            "uei": uei,
            "legal_name": seed.name,
            "registration_status": "Active",
            "expiration_date": "2027-09-30",
            "has_delinquent_debt": bucket in {"high", "critical"} and seed.idx % 3 == 0,
            "debt_amount": 85000 if bucket in {"high", "critical"} and seed.idx % 3 == 0 else 0,
            "has_exclusion": bucket == "critical" and seed.idx % 11 == 0,
            "exclusion_type": "Performance" if bucket == "critical" and seed.idx % 11 == 0 else "",
        },
        "crustdata": {
            "matched_uei": uei,
            "headcount": 40 + seed.idx * 2,
            "headcount_qoq_pct": -8.0 if bucket in {"low", "medium"} else -22.0,
            "ceo_name": "N/A",
            "employee_reviews_rating": 3.6 if bucket in {"low", "medium"} else 2.9,
            "recent_review_snippets": ["Staffing pressure noted in operations teams."],
            "job_postings": 3 + (seed.idx % 5),
            "leadership_vacancy": bucket in {"high", "critical"} and seed.idx % 2 == 0,
        },
        "risk": {
            "total": total,
            "level": level,
            "signals": [
                {
                    "source": "USASpending",
                    "severity": "medium" if bucket in {"medium", "high", "critical"} else "low",
                    "label": "Spend cadence",
                    "detail": "Burn/time profile evaluated against expected drawdown.",
                },
                {
                    "source": "FAC",
                    "severity": "high" if bucket in {"high", "critical"} else "medium",
                    "label": "Audit pattern",
                    "detail": "Most recent FAC filing reviewed for control findings.",
                },
                {
                    "source": "SAM",
                    "severity": "high" if bucket in {"high", "critical"} else "low",
                    "label": "Entity integrity",
                    "detail": "SAM status and debt signals applied to risk model.",
                },
                {
                    "source": "Crustdata",
                    "severity": "high" if bucket in {"high", "critical"} else "low",
                    "label": "Workforce stress",
                    "detail": "Headcount and leadership indicators incorporated.",
                },
            ],
        },
        "risk_score": None,  # Back-compat alias filled below.
        "timeline": make_timeline(seed, level),
    }
    record["audits"] = record["audit"]
    record["risk_score"] = record["risk"]
    return record


def build() -> list[dict]:
    scores = LOW_SCORES + MEDIUM_SCORES + HIGH_SCORES + CRITICAL_SCORES
    assert len(scores) == 73
    rows: list[dict] = []

    for i, seed in enumerate(SEEDS):
        total = scores[i]
        bucket = level_for(total)
        rows.append(make_base_record(seed, total, bucket))

    # Inject required top case details exactly.
    sunrise = rows[0]
    sunrise["grant"].update(
        {
            "recipient_name": "Sunrise Community Health Inc.",
            "recipient_uei": "J4KNMH7E2XL3",
            "state": "CO",
            "city": "Greeley",
            "award_amount": 3_800_000,
            "total_outlays": 3_458_000,
            "burn_rate_pct": 91.0,
            "time_elapsed_pct": 95.0,
            "burn_time_ratio": 0.96,
            "modification_count": 5,
        }
    )
    sunrise["audit"] = {
        "auditee_uei": "J4KNMH7E2XL3",
        "audit_years": [2022, 2023, 2024],
        "audit_opinion": "qualified",
        "findings": [
            {
                "year": 2022,
                "type_requirement": "Personnel Cost Controls",
                "is_material_weakness": True,
                "is_significant_deficiency": True,
                "is_questioned_costs": False,
                "questioned_costs_amount": 0,
                "is_repeated": True,
            },
            {
                "year": 2023,
                "type_requirement": "Personnel Cost Controls",
                "is_material_weakness": True,
                "is_significant_deficiency": True,
                "is_questioned_costs": False,
                "questioned_costs_amount": 0,
                "is_repeated": True,
            },
            {
                "year": 2024,
                "type_requirement": "Personnel Cost Controls",
                "is_material_weakness": True,
                "is_significant_deficiency": True,
                "is_questioned_costs": True,
                "questioned_costs_amount": 287000,
                "is_repeated": True,
            },
        ],
        "has_going_concern": False,
        "has_material_noncompliance": True,
    }
    sunrise["audits"] = sunrise["audit"]
    sunrise["sam"] = {
        "uei": "J4KNMH7E2XL3",
        "legal_name": "Sunrise Community Health Inc.",
        "registration_status": "Active",
        "expiration_date": "2026-11-20",
        "has_delinquent_debt": True,
        "debt_amount": 142000,
        "has_exclusion": False,
        "exclusion_type": "",
    }
    sunrise["crustdata"] = {
        "matched_uei": "J4KNMH7E2XL3",
        "headcount": 96,
        "headcount_qoq_pct": -34.0,
        "ceo_name": "Interim Leadership Team",
        "employee_reviews_rating": 2.8,
        "recent_review_snippets": [
            "Chronic staffing turnover in operations and billing.",
            "Leadership transition has delayed corrective action plans.",
        ],
        "job_postings": 4,
        "leadership_vacancy": True,
    }
    sunrise["risk"] = {
        "total": 9.2,
        "level": "critical",
        "signals": [
            {
                "source": "FAC",
                "severity": "critical",
                "label": "Consecutive material weaknesses",
                "detail": "Material weaknesses persisted FY2022-FY2024 in personnel cost controls.",
            },
            {
                "source": "FAC",
                "severity": "high",
                "label": "Questioned costs",
                "detail": "FAC reported $287,000 in questioned costs.",
            },
            {
                "source": "USASpending",
                "severity": "medium",
                "label": "Burn profile pressure",
                "detail": "91% spend against 95% elapsed time suggests constrained closeout margin.",
            },
            {
                "source": "SAM",
                "severity": "high",
                "label": "Delinquent federal debt",
                "detail": "SAM indicates $142,000 delinquent debt.",
            },
            {
                "source": "Crustdata",
                "severity": "high",
                "label": "Headcount contraction",
                "detail": "Workforce declined 34% quarter-over-quarter.",
            },
            {
                "source": "Crustdata",
                "severity": "medium",
                "label": "Leadership vacancy",
                "detail": "Executive Director role remains vacant.",
            },
        ],
    }
    sunrise["risk_score"] = sunrise["risk"]
    sunrise["timeline"] = [
        {
            "date": "2022-10-05",
            "source": "FAC",
            "severity": "high",
            "description": "FY2022 single audit identified material weakness in personnel cost controls.",
        },
        {
            "date": "2023-10-09",
            "source": "FAC",
            "severity": "high",
            "description": "FY2023 audit repeated personnel cost control material weakness.",
        },
        {
            "date": "2024-09-30",
            "source": "USASpending",
            "severity": "medium",
            "description": "USASpending refresh showed burn rate at 91% on $3.8M award.",
        },
        {
            "date": "2024-10-11",
            "source": "FAC",
            "severity": "critical",
            "description": "FY2024 audit reported third consecutive material weakness and $287K questioned costs.",
        },
        {
            "date": "2024-11-02",
            "source": "SAM",
            "severity": "high",
            "description": "SAM flagged $142K delinquent federal debt on active registration.",
        },
        {
            "date": "2024-11-18",
            "source": "Crustdata",
            "severity": "high",
            "description": "Crustdata showed 34% headcount decline and Executive Director vacancy.",
        },
        {
            "date": "2024-12-20",
            "source": "USASpending",
            "severity": "critical",
            "description": "Composite risk score finalized at 9.2 (critical).",
        },
    ]

    return rows


def main() -> None:
    rows = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} records to {OUT}")


if __name__ == "__main__":
    main()
