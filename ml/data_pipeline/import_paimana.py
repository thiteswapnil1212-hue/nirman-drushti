"""Import processed PAIMANA observations into the PostgreSQL project domain."""

from __future__ import annotations

import argparse
import csv
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.paimana import PaimanaObservation
from app.models.project import CostHistory, ProgressHistory, Project

LOGGER = logging.getLogger(__name__)


@dataclass
class ImportPlan:
    observations: list[dict[str, object]]
    projects: dict[str, dict[str, object]]
    progress_history: list[dict[str, object]]
    cost_history: list[dict[str, object]]
    skipped: list[dict[str, str]]


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as stream:
        return [dict(row) for row in csv.DictReader(stream)]


def _date(value: str | None) -> date | None:
    if not value:
        return None
    year, month = (int(part) for part in value.split("-", 1))
    return date(year, month, 1)


def _decimal(value: str | None) -> Decimal | None:
    return Decimal(value) if value else None


def _observation_id(row: dict[str, str], index: int) -> str:
    return f"{row.get('source_filename', '')}:{row.get('sl_no', '')}:{index}"


def build_import_plan(input_dir: str | Path, mapping_path: str | Path) -> ImportPlan:
    rows: list[dict[str, str]] = []
    for path in sorted(Path(input_dir).glob("paimana_*.csv")):
        rows.extend(_read_csv(path))
    mappings = {row["observation_id"]: row for row in _read_csv(Path(mapping_path))}
    observations: list[dict[str, object]] = []
    projects: dict[str, dict[str, object]] = {}
    progress_history: list[dict[str, object]] = []
    cost_history: list[dict[str, object]] = []
    skipped: list[dict[str, str]] = []
    grouped: defaultdict[str, list[tuple[dict[str, str], dict[str, str]]]] = defaultdict(list)

    for index, row in enumerate(rows):
        mapping = mappings.get(_observation_id(row, index))
        if mapping is None:
            skipped.append({"observation_id": _observation_id(row, index), "reason": "missing identity mapping"})
            continue
        identity = mapping.get("project_identity") or None
        observation = {
            "observation_id": _observation_id(row, index),
            "project_identity": identity,
            "match_status": mapping.get("match_status", "unmatched"),
            "match_method": mapping.get("match_method") or None,
            "review_reason": None,
            "duplicate_observation": mapping.get("duplicate_observation") == "true",
            "sl_no": row.get("sl_no") or None,
            "project_code": row.get("project_code") or None,
            "legacy_ocms_code": row.get("legacy_ocms_code") or None,
            "pmgid": row.get("pmgid") or None,
            "project_name": row.get("project_name") or None,
            "state": row.get("state") or None,
            "implementing_agency": row.get("implementing_agency") or None,
            "reporting_period": _date(row.get("reporting_period")),
            "source_filename": row.get("source_filename", ""),
            "start_date": _date(row.get("start_date")),
            "original_completion_date": _date(row.get("original_completion_date")),
            "revised_completion_date": _date(row.get("revised_completion_date")),
            "original_cost": _decimal(row.get("original_cost")),
            "revised_cost": _decimal(row.get("revised_cost")),
            "cumulative_expenditure": _decimal(row.get("cumulative_expenditure")),
            "physical_progress": _decimal(row.get("physical_progress")),
        }
        observations.append(observation)
        if mapping.get("match_status") == "matched" and identity:
            grouped[identity].append((row, mapping))
            progress_history.append({
                "project_identity": identity,
                "reporting_period": observation["reporting_period"],
                "physical_progress": observation["physical_progress"],
                "expected_progress": None,
                "expenditure": observation["cumulative_expenditure"],
                "status": None,
                "source_filename": observation["source_filename"],
            })
            cost_history.append({
                "project_identity": identity,
                "recorded_at": observation["reporting_period"],
                "original_cost": observation["original_cost"],
                "current_cost": observation["revised_cost"],
                "expenditure": observation["cumulative_expenditure"],
                "source_filename": observation["source_filename"],
            })

    for identity, identity_rows in grouped.items():
        row, _ = max(identity_rows, key=lambda item: item[0].get("reporting_period", ""))
        projects[identity] = {
            "project_identity": identity,
            "project_code": row.get("project_code") if len(row.get("project_code", "")) <= 64 else None,
            "legacy_ocms_code": row.get("legacy_ocms_code") or None,
            "pmgid": row.get("pmgid") or None,
            "name": row.get("project_name") or None,
            "state": row.get("state") or None,
            "implementing_agency": row.get("implementing_agency") or None,
            "original_cost": _decimal(row.get("original_cost")),
            "current_cost": _decimal(row.get("revised_cost")),
            "expenditure": _decimal(row.get("cumulative_expenditure")),
            "physical_progress": _decimal(row.get("physical_progress")),
            "planned_start_date": _date(row.get("start_date")),
            "planned_completion_date": _date(row.get("original_completion_date")),
            "expected_completion_date": _date(row.get("revised_completion_date")),
        }
    return ImportPlan(observations, projects, progress_history, cost_history, skipped)


def import_plan(database: Session, plan: ImportPlan) -> dict[str, int]:
    project_ids: dict[str, UUID] = {}
    skipped = list(plan.skipped)
    for identity, values in plan.projects.items():
        project = database.scalar(select(Project).where(Project.project_identity == identity))
        if project is None:
            project = Project(**values)
            database.add(project)
            database.flush()
        project_ids[identity] = project.id

    existing_observations = set(database.scalars(select(PaimanaObservation.observation_id)).all())
    imported_observations = 0
    imported_progress = 0
    imported_cost = 0
    for values in plan.observations:
        observation_id = str(values["observation_id"])
        if observation_id in existing_observations:
            continue
        identity = values.get("project_identity")
        project_id = project_ids.get(str(identity)) if identity else None
        observation = PaimanaObservation(project_id=project_id, **values)
        database.add(observation)
        imported_observations += 1
    for values in plan.progress_history:
        identity = str(values.pop("project_identity"))
        project_id = project_ids.get(identity)
        if project_id is not None:
            database.add(ProgressHistory(project_id=project_id, project_identity=identity, **values))
            imported_progress += 1
    for values in plan.cost_history:
        identity = str(values.pop("project_identity"))
        project_id = project_ids.get(identity)
        if project_id is not None:
            database.add(CostHistory(project_id=project_id, project_identity=identity, **values))
            imported_cost += 1
    database.commit()
    return {"projects": len(project_ids), "observations": imported_observations, "progress_history": imported_progress, "cost_history": imported_cost, "skipped": len(skipped)}


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=Path("data/processed"))
    parser.add_argument("--mapping", type=Path, default=Path("data/processed/project_identity_mapping.csv"))
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    from app.db.session import SessionLocal

    plan = build_import_plan(args.input_dir, args.mapping)
    with SessionLocal() as database:
        result = import_plan(database, plan)
    LOGGER.info("import complete: %s", result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())