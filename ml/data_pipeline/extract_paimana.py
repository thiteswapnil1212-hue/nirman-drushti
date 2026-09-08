"""Extract Table 6 project observations from PAIMANA Flash Report PDFs."""

from __future__ import annotations

import argparse
import csv
import logging
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable, Sequence

LOGGER = logging.getLogger(__name__)

OUTPUT_FIELDS = [
    "sl_no",
    "project_name",
    "agency",
    "project_code",
    "legacy_ocms_code",
    "pmgid",
    "state",
    "approval_start_date",
    "original_target_doc",
    "revised_doc",
    "original_cost",
    "revised_cost",
    "cumulative_expenditure",
    "physical_progress",
    "reporting_period",
    "source_filename",
]

TABLE_TITLE = re.compile(
    r"table\s*6\s*[:.\-]?\s*all\s+ongoing\s+projects|"
    r"table\s*[-:]{1,2}\s*7\s*\.\s*project list:\s*ongoing projects",
    re.IGNORECASE,
)
TABLE_END = re.compile(r"^\s*table\s*[7-9]\b|^\s*annexure\b|^\s*notes?\b", re.IGNORECASE)
PERIOD_PATTERNS = (
    re.compile(r"(?P<month>January|February|March|April|May|June|July|August|September|October|November|December)[ _-]*(?P<year>20\d{2})", re.IGNORECASE),
    re.compile(r"(?P<year>20\d{2})[ _-]*(?P<month>0?[1-9]|1[0-2])", re.IGNORECASE),
)
 
MONTHS = {month.lower(): number for number, month in enumerate(("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"), 1)}


class Table6NotFoundError(ValueError):
    """Raised when a PDF does not contain the target table."""


class PdfParserUnavailableError(RuntimeError):
    """Raised when the optional PDF parsing dependency is not installed."""


@dataclass(frozen=True)
class Table6Section:
    text: str
    start_page: int
    end_page: int


def reporting_period_from_filename(filename: str | Path) -> str:
    """Return a YYYY-MM period from a report filename."""
    name = Path(filename).stem
    for pattern in PERIOD_PATTERNS:
        match = pattern.search(name)
        if match is None:
            continue
        month = match.group("month")
        month_number = int(month) if month.isdigit() else MONTHS[month.lower()]
        return f"{int(match.group('year')):04d}-{month_number:02d}"
    raise ValueError(f"Could not derive reporting period from filename: {filename}")


def parse_numeric(value: str | None) -> str | None:
    """Normalize a numeric source value without calculating or rounding it."""
    value = clean_source_value(value)
    if value is None:
        return None
    candidate = value.replace(",", "")
    candidate = re.sub(r"^[^\d+\-.]+|[^\d.]+$", "", candidate)
    try:
        Decimal(candidate)
    except InvalidOperation:
        return value
    return candidate


def clean_source_value(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", str(value)).strip()
    if not cleaned or cleaned in {"-", "—", "–"}:
        return None
    return cleaned


def parse_revised_value(value: str | None) -> str | None:
    """Return the value inside parentheses when present, preserving its text."""
    cleaned = clean_source_value(value)
    if cleaned is None:
        return None
    match = re.search(r"\(([^()]*)\)", cleaned)
    return clean_source_value(match.group(1)) if match else cleaned


def find_table6(pages: Sequence[str]) -> Table6Section:
    candidates = [
        index
        for index, page in enumerate(pages)
        if any(line.strip().lower().startswith("table 6:") for line in page.splitlines())
    ]
    if not candidates:
        candidates = [
            index
            for index, page in enumerate(pages[2:], start=2)
            if any(line.strip().lower().startswith("table:-7.") for line in page.splitlines())
        ]
        if not candidates:
            candidates = [index for index, page in enumerate(pages) if TABLE_TITLE.search(page)]
    start = candidates[0] if candidates else None
    if start is None:
        raise Table6NotFoundError("Table 6: All Ongoing Projects was not detected")
    collected: list[str] = []
    end = start
    for index in range(start, len(pages)):
        page = pages[index]
        if index > start and TABLE_END.search(page):
            break
        collected.append(page)
        end = index
    return Table6Section("\n".join(collected), start + 1, end + 1)


def _split_row(line: str) -> list[str]:
    return [clean_source_value(part) or "" for part in re.split(r"\s*\|\s*|\t+", line.strip())]


def parse_table6_rows(section_text: str, reporting_period: str, source_filename: str) -> list[dict[str, str | None]]:
    """Parse pipe/tab-delimited Table 6 text while skipping repeated headers."""
    rows: list[dict[str, str | None]] = []
    current: list[str] | None = None

    def append_row(cells: list[str] | None) -> None:
        if not cells:
            return
        normalized = (cells + [""] * 14)[:14]
        rows.append({
            "sl_no": clean_source_value(normalized[0]) if len(normalized) > 0 else None,
            "project_name": clean_source_value(normalized[1]),
            "agency": clean_source_value(normalized[2]),
            "project_code": clean_source_value(normalized[3]),
            "legacy_ocms_code": clean_source_value(normalized[4]),
            "pmgid": clean_source_value(normalized[5]),
            "state": clean_source_value(normalized[6]),
            "approval_start_date": clean_source_value(normalized[7]),
            "original_target_doc": clean_source_value(normalized[8]),
            "revised_doc": parse_revised_value(normalized[9]),
            "original_cost": parse_numeric(normalized[10]),
            "revised_cost": parse_numeric(parse_revised_value(normalized[11])),
            "cumulative_expenditure": parse_numeric(normalized[12]),
            "physical_progress": parse_numeric(normalized[13]),
            "reporting_period": reporting_period,
            "source_filename": source_filename,
        })

    for raw_line in section_text.splitlines():
        line = raw_line.strip()
        if not line or TABLE_TITLE.search(line) or line.lower() == "all ongoing projects" or _is_header(line):
            continue
        cells = _split_row(line)
        if not cells:
            continue
        if re.fullmatch(r"\d+[.)]?", cells[0]):
            append_row(current)
            current = cells
        elif current is not None and len(current) >= 2:
            if len(cells) == 1:
                current[1] = f"{current[1]} {cells[0]}".strip()
            else:
                current[1] = f"{current[1]} {cells[0]}".strip()
                for index, cell in enumerate(cells[1:], start=2):
                    if index < len(current):
                        current[index] = f"{current[index]} {cell}".strip()
                    else:
                        current.append(cell)
    append_row(current)
    return rows


def _is_header(line: str) -> bool:
    lowered = line.lower()
    return "project name" in lowered and ("agency" in lowered or "project code" in lowered)


def _parenthesized_values(value: str) -> list[str | None]:
    return [clean_source_value(match) for match in re.findall(r"\(([^()]*)\)", value)]


def _parse_structured_pdf_row(
    cells: Sequence[str | None],
    reporting_period: str,
    source_filename: str,
) -> dict[str, str | None] | None:
    if len(cells) >= 9 and re.fullmatch(r"\d+[.)]?", clean_source_value(cells[2]) or ""):
        return _parse_legacy_structured_pdf_row(cells, reporting_period, source_filename)
    if len(cells) < 8 or not re.fullmatch(r"\d+[.)]?", clean_source_value(cells[0]) or ""):
        return None
    project_lines = [line.strip() for line in (cells[1] or "").splitlines() if line.strip()]
    if not project_lines:
        return None
    metadata_line = project_lines[-1]
    metadata_values = _parenthesized_values(metadata_line)
    if len(project_lines) >= 4:
        agency = clean_source_value(project_lines[-3].strip("()"))
        project_code = clean_source_value(project_lines[-2].strip("()"))
        project_name = clean_source_value(" ".join(project_lines[:-3]))
        legacy_ocms_code = metadata_values[0] if metadata_values else None
        pmgid = metadata_values[1] if len(metadata_values) > 1 else None
    else:
        agency = None
        project_code = None
        project_name = clean_source_value(" ".join(project_lines))
        legacy_ocms_code = None
        pmgid = None

    date_values = [clean_source_value(line.strip("()")) for line in (cells[3] or "").splitlines() if line.strip()]
    doc_values = [clean_source_value(line.strip("()")) for line in (cells[4] or "").splitlines() if line.strip()]
    cost_values = [parse_numeric(line.strip("()")) for line in (cells[5] or "").splitlines() if line.strip()]
    return {
        "sl_no": clean_source_value(cells[0]),
        "project_name": project_name,
        "agency": agency,
        "project_code": project_code,
        "legacy_ocms_code": legacy_ocms_code,
        "pmgid": pmgid,
        "state": clean_source_value(cells[2]),
        "approval_start_date": date_values[0] if date_values else None,
        "original_target_doc": doc_values[0] if doc_values else None,
        "revised_doc": doc_values[1] if len(doc_values) > 1 else None,
        "original_cost": cost_values[0] if cost_values else None,
        "revised_cost": cost_values[1] if len(cost_values) > 1 else None,
        "cumulative_expenditure": parse_numeric(cells[6]),
        "physical_progress": parse_numeric(cells[7]),
        "reporting_period": reporting_period,
        "source_filename": source_filename,
    }

def _parse_legacy_structured_pdf_row(
    cells: Sequence[str | None],
    reporting_period: str,
    source_filename: str,
) -> dict[str, str | None]:
    project_lines = [line.strip() for line in (cells[3] or "").splitlines() if line.strip()]
    project_name = clean_source_value(" ".join(project_lines[:-2])) if len(project_lines) >= 3 else clean_source_value(" ".join(project_lines))
    agency = clean_source_value(project_lines[-2].strip("()")) if len(project_lines) >= 2 else None
    project_code = clean_source_value(project_lines[-1].strip("()")) if len(project_lines) >= 1 else None
    date_values = [clean_source_value(line.strip("(){}")) for line in (cells[5] or "").splitlines() if line.strip()]
    cost_values = [parse_numeric(line.strip("(){}")) for line in (cells[6] or "").splitlines() if line.strip()]
    return {
        "sl_no": clean_source_value(cells[2]),
        "project_name": project_name,
        "agency": agency,
        "project_code": project_code,
        "legacy_ocms_code": None,
        "pmgid": None,
        "state": clean_source_value(cells[0]),
        "approval_start_date": clean_source_value(cells[4]),
        "original_target_doc": date_values[0] if date_values else None,
        "revised_doc": date_values[1] if len(date_values) > 1 else None,
        "original_cost": cost_values[0] if cost_values else None,
        "revised_cost": cost_values[1] if len(cost_values) > 1 else None,
        "cumulative_expenditure": parse_numeric(cells[7]),
        "physical_progress": parse_numeric(cells[8]),
        "reporting_period": reporting_period,
        "source_filename": source_filename,
    }

def _extract_pdf_pages(pdf_path: Path) -> list[str]:
    try:
        import pdfplumber
    except ImportError as error:
        raise PdfParserUnavailableError("PDF extraction requires optional dependency 'pdfplumber'. Install it in the pipeline environment.") from error
    with pdfplumber.open(pdf_path) as pdf:
        pages: list[str] = []
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            table_lines: list[str] = []
            for table in page.extract_tables() or []:
                table_lines.extend(" | ".join(cell or "" for cell in row) for row in table)
            pages.append("\n".join(part for part in (page_text, "\n".join(table_lines)) if part))
        return pages


def _extract_pdf_tables(pdf_path: Path) -> list[list[list[list[str | None]]]]:
    try:
        import pdfplumber
    except ImportError as error:
        raise PdfParserUnavailableError("PDF extraction requires optional dependency 'pdfplumber'. Install it in the pipeline environment.") from error
    with pdfplumber.open(pdf_path) as pdf:
        return [[table for table in page.extract_tables() or []] for page in pdf.pages]


def _parse_pdf_page_rows(
    tables: Sequence[Sequence[Sequence[str | None]]],
    page_text: str,
    reporting_period: str,
    source_filename: str,
) -> list[dict[str, str | None]]:
    table_lines: list[dict[str, str | None]] = []
    for table in tables:
        for row in table:
            structured_row = _parse_structured_pdf_row(row, reporting_period, source_filename)
            if structured_row is not None:
                table_lines.append(structured_row)
    if table_lines:
        return table_lines
    return parse_table6_rows(page_text, reporting_period, source_filename)


def extract_pdf(pdf_path: str | Path, output_dir: str | Path = "data/extracted") -> Path:
    input_path = Path(pdf_path)
    if input_path.suffix.lower() != ".pdf":
        raise ValueError(f"Expected a PDF input: {input_path}")
    period = reporting_period_from_filename(input_path.name)
    pages = _extract_pdf_pages(input_path)
    section = find_table6(pages)
    tables_by_page = _extract_pdf_tables(input_path)
    rows: list[dict[str, str | None]] = []
    for page_index in range(section.start_page - 1, section.end_page):
        page_rows = _parse_pdf_page_rows(
            tables_by_page[page_index],
            pages[page_index],
            period,
            input_path.name,
        )
        LOGGER.info("Table 6 page %s detected rows: %s", page_index + 1, len(page_rows))
        rows.extend(page_rows)
    if not rows:
        raise ValueError("Table 6 was detected but no project rows could be parsed")
    destination = Path(output_dir)
    destination.mkdir(parents=True, exist_ok=True)
    output_path = destination / f"paimana_{period.replace('-', '_')}.csv"
    with output_path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    LOGGER.info("input file: %s", input_path)
    LOGGER.info("detected reporting period: %s", period)
    LOGGER.info("Table 6 start/end: pages %s-%s", section.start_page, section.end_page)
    LOGGER.info("extracted row count: %s", len(rows))
    LOGGER.info("output file: %s", output_path)
    return output_path


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf_path", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("data/extracted"))
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    extract_pdf(args.pdf_path, args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())