"""Clean extracted PAIMANA project CSV files without matching or enrichment."""

from __future__ import annotations

import argparse
import csv
import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable

LOGGER = logging.getLogger(__name__)

OUTPUT_FIELDS = [
    "sl_no",
    "project_code",
    "legacy_ocms_code",
    "pmgid",
    "project_name",
    "state",
    "implementing_agency",
    "start_date",
    "original_completion_date",
    "revised_completion_date",
    "original_cost",
    "revised_cost",
    "cumulative_expenditure",
    "physical_progress",
    "reporting_period",
    "source_filename",
]

SOURCE_FIELDS = {
    "implementing_agency": "agency",
    "start_date": "approval_start_date",
    "original_completion_date": "original_target_doc",
    "revised_completion_date": "revised_doc",
}
NUMERIC_FIELDS = {
    "original_cost",
    "revised_cost",
    "cumulative_expenditure",
    "physical_progress",
}
DATE_FIELDS = {
    "start_date",
    "original_completion_date",
    "revised_completion_date",
}
IDENTIFIER_FIELDS = {"project_code", "legacy_ocms_code", "pmgid"}
MONTH_NAMES = {
    name.lower(): number
    for number, name in enumerate(
        (
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ),
        1,
    )
}
MONTH_NAMES.update({name[:3].lower(): number for name, number in MONTH_NAMES.items()})


def clean_text(value: str | None) -> str | None:
    """Trim and collapse source whitespace; map source missing markers to null."""
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", str(value)).strip()
    if not cleaned or cleaned in {"-", "—", "–", "N.A.", "NA", "n/a"}:
        return None
    return cleaned


def parse_numeric(value: str | None) -> str | None:
    """Return a safely normalized numeric value, or null when it is not numeric."""
    cleaned = clean_text(value)
    if cleaned is None:
        return None
    candidate = cleaned.replace(",", "")
    candidate = re.sub(r"^[^\d+\-.]+|[^\d.]+$", "", candidate)
    if not candidate or candidate in {".", "+", "-"}:
        return None
    try:
        number = Decimal(candidate)
    except InvalidOperation:
        return None
    return format(number, "f")


def parse_date(value: str | None) -> str | None:
    """Normalize known source dates to YYYY-MM without inventing a day."""
    cleaned = clean_text(value)
    if cleaned is None:
        return None
    normalized = cleaned.replace(".", "-").replace("/", "-")
    for pattern, fmt in (
        (r"^(\d{1,2})-(\d{1,2})-(\d{4})$", "%d-%m-%Y"),
        (r"^(\d{1,2})-(\d{4})$", "%m-%Y"),
        (r"^(\d{4})-(\d{1,2})$", "%Y-%m"),
    ):
        if re.fullmatch(pattern, normalized):
            try:
                return datetime.strptime(normalized, fmt).strftime("%Y-%m")
            except ValueError:
                return None
    month_year = re.fullmatch(r"([A-Za-z]+)[ -](\d{4})", cleaned)
    if month_year:
        month = MONTH_NAMES.get(month_year.group(1).lower()[:3]) or MONTH_NAMES.get(month_year.group(1).lower())
        if month:
            return f"{month_year.group(2)}-{month:02d}"
    return None


def clean_row(row: dict[str, str]) -> dict[str, str | None] | None:
    cleaned: dict[str, str | None] = {}
    for output_field in OUTPUT_FIELDS:
        source_field = SOURCE_FIELDS.get(output_field, output_field)
        value = row.get(source_field)
        if output_field in NUMERIC_FIELDS:
            cleaned[output_field] = parse_numeric(value)
        elif output_field in DATE_FIELDS:
            cleaned[output_field] = parse_date(value)
        else:
            cleaned[output_field] = clean_text(value)

    if cleaned["project_code"] is None and cleaned["project_name"] is None:
        return None
    return cleaned


def clean_file(input_path: str | Path, output_dir: str | Path = "data/processed") -> tuple[Path, int, int]:
    source = Path(input_path)
    output_directory = Path(output_dir)
    rows_read = 0
    rejected_rows = 0
    cleaned_rows: list[dict[str, str | None]] = []
    with source.open("r", newline="", encoding="utf-8-sig") as stream:
        for row in csv.DictReader(stream):
            rows_read += 1
            cleaned = clean_row(row)
            if cleaned is None:
                rejected_rows += 1
            else:
                cleaned_rows.append(cleaned)

    output_directory.mkdir(parents=True, exist_ok=True)
    period = clean_text(cleaned_rows[0]["reporting_period"]) if cleaned_rows else None
    if period is None:
        period = source.stem.removeprefix("paimana_").replace("_", "-")
    output_path = output_directory / f"paimana_{period.replace('-', '_')}.csv"
    with output_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(cleaned_rows)
    LOGGER.info("input file: %s; output file: %s; rows read: %s; rows written: %s; rejected rows: %s", source, output_path, rows_read, len(cleaned_rows), rejected_rows)
    return output_path, rows_read, rejected_rows


def clean_all(input_dir: str | Path = "data/extracted", output_dir: str | Path = "data/processed") -> list[tuple[Path, int, int]]:
    results = []
    for source in sorted(Path(input_dir).glob("*.csv")):
        results.append(clean_file(source, output_dir))
    return results


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=Path("data/extracted"))
    parser.add_argument("--output-dir", type=Path, default=Path("data/processed"))
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    clean_all(args.input_dir, args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())