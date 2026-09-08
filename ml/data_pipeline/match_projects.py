"""Match PAIMANA observations into cautious, reviewable project identities."""

from __future__ import annotations

import argparse
import csv
import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import Iterable

LOGGER = logging.getLogger(__name__)

IDENTIFIER_FIELDS = ("project_code", "legacy_ocms_code", "pmgid")
FALLBACK_FIELDS = ("project_name", "implementing_agency", "state")
MAPPING_FIELDS = (
    "observation_id",
    "project_identity",
    "match_status",
    "match_method",
    "reporting_period",
    "source_filename",
    "sl_no",
    "duplicate_observation",
)
REVIEW_FIELDS = MAPPING_FIELDS + ("review_reason", "candidate_identities")


def normalize_text(value: str | None) -> str:
    """Normalize text for comparison only; never overwrite source values."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip().casefold()


def observation_id(row: dict[str, str], index: int) -> str:
    return f"{row.get('source_filename', '')}:{row.get('sl_no', '')}:{index}"


def _identifier_value(row: dict[str, str], field: str) -> str:
    return normalize_text(row.get(field))


def _fallback_key(row: dict[str, str]) -> tuple[str, str, str] | None:
    values = tuple(normalize_text(row.get(field)) for field in FALLBACK_FIELDS)
    return values if all(values) else None


def _load_rows(input_dir: str | Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for path in sorted(Path(input_dir).glob("*.csv")):
        with path.open("r", newline="", encoding="utf-8-sig") as stream:
            rows.extend(dict(row) for row in csv.DictReader(stream))
    return rows


def match_rows(rows: list[dict[str, str]]) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    """Return mapping and manual-review rows without mutating source observations."""
    parent = list(range(len(rows)))

    def find(value: int) -> int:
        while parent[value] != value:
            parent[value] = parent[parent[value]]
            value = parent[value]
        return value

    def union(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    identifier_indexes: dict[tuple[str, str], list[int]] = defaultdict(list)
    for index, row in enumerate(rows):
        for field in IDENTIFIER_FIELDS:
            value = _identifier_value(row, field)
            if value:
                identifier_indexes[(field, value)].append(index)
    for indexes in identifier_indexes.values():
        for index in indexes[1:]:
            union(indexes[0], index)

    fallback_only_indexes: dict[tuple[str, str, str], list[int]] = defaultdict(list)
    for index, row in enumerate(rows):
        if not any(_identifier_value(row, field) for field in IDENTIFIER_FIELDS):
            key = _fallback_key(row)
            if key:
                fallback_only_indexes[key].append(index)
    for indexes in fallback_only_indexes.values():
        for index in indexes[1:]:
            union(indexes[0], index)

    components: dict[int, list[int]] = defaultdict(list)
    for index in range(len(rows)):
        components[find(index)].append(index)
    component_ids = {root: f"project-{number:06d}" for number, root in enumerate(sorted(components), 1)}
    identity_keys: dict[tuple[str, str], set[str]] = defaultdict(set)
    for root, indexes in components.items():
        identity = component_ids[root]
        for index in indexes:
            for field in IDENTIFIER_FIELDS:
                value = _identifier_value(rows[index], field)
                if value:
                    identity_keys[(field, value)].add(identity)

    fallback_indexes: dict[tuple[str, str, str], set[str]] = defaultdict(set)
    for root, indexes in components.items():
        identity = component_ids[root]
        for index in indexes:
            key = _fallback_key(rows[index])
            if key:
                fallback_indexes[key].add(identity)

    mappings: list[dict[str, str]] = []
    reviews: list[dict[str, str]] = []
    for index, row in enumerate(rows):
        identifiers = [(field, _identifier_value(row, field)) for field in IDENTIFIER_FIELDS]
        candidates: set[str] = set()
        matched_field = ""
        for field, value in identifiers:
            if value and identity_keys[(field, value)]:
                candidates.update(identity_keys[(field, value)])
                if not matched_field:
                    matched_field = field
        fallback_candidates = fallback_indexes.get(_fallback_key(row), set())
        if not candidates and fallback_candidates:
            candidates = set(fallback_candidates)
            matched_field = "normalized_name_agency_state"

        status = "matched"
        method = matched_field
        identity = next(iter(candidates), "") if len(candidates) == 1 else ""
        reason = ""
        if len(candidates) > 1:
            status, method, reason = "ambiguous", "", "conflicting identifier candidates"
        elif not candidates:
            status, method, reason = "unmatched", "", "no identifier or complete fallback key"
        elif method == "normalized_name_agency_state" and len(fallback_candidates) > 1:
            status, method, identity, reason = "ambiguous", "", "", "multiple fallback candidates"

        mapping = {
            "observation_id": observation_id(row, index),
            "project_identity": identity,
            "match_status": status,
            "match_method": method,
            "reporting_period": row.get("reporting_period", ""),
            "source_filename": row.get("source_filename", ""),
            "sl_no": row.get("sl_no", ""),
            "duplicate_observation": "false",
        }
        mappings.append(mapping)
        if status != "matched":
            reviews.append({**mapping, "review_reason": reason, "candidate_identities": ";".join(sorted(candidates))})

    by_month_identity: dict[tuple[str, str], list[int]] = defaultdict(list)
    for index, mapping in enumerate(mappings):
        if mapping["match_status"] == "matched":
            by_month_identity[(mapping["reporting_period"], mapping["project_identity"])].append(index)
    for indexes in by_month_identity.values():
        if len(indexes) > 1:
            for index in indexes:
                mappings[index]["duplicate_observation"] = "true"
    return mappings, reviews


def write_reports(mappings: list[dict[str, str]], reviews: list[dict[str, str]], output_dir: str | Path) -> tuple[Path, Path]:
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    mapping_path = destination / "project_identity_mapping.csv"
    review_path = destination / "project_identity_review.csv"
    for path, fields, data in ((mapping_path, MAPPING_FIELDS, mappings), (review_path, REVIEW_FIELDS, reviews)):
        with path.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=fields)
            writer.writeheader()
            writer.writerows(data)
    return mapping_path, review_path


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=Path("data/processed"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/processed"))
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    mappings, reviews = match_rows(_load_rows(args.input_dir))
    mapping_path, review_path = write_reports(mappings, reviews, args.output_dir)
    LOGGER.info("mapping file: %s; review file: %s; observations: %s; manual review: %s", mapping_path, review_path, len(mappings), len(reviews))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())