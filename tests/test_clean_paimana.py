import csv

from ml.data_pipeline.clean_paimana import clean_file, clean_row, clean_text, parse_date, parse_numeric


def test_dash_becomes_null() -> None:
    assert clean_text("-") is None
    assert clean_row({"project_code": "P-1", "project_name": "-"})["project_name"] is None


def test_numeric_parsing() -> None:
    assert parse_numeric("1,234.50 Crore") == "1234.50"
    assert parse_numeric("N.A.") is None


def test_date_parsing() -> None:
    assert parse_date("03/2023") == "2023-03"
    assert parse_date("Jun-2023") == "2023-06"
    assert parse_date("-") is None


def test_whitespace_normalization() -> None:
    assert clean_text("  Project\n\tName  ") == "Project Name"


def test_metadata_preservation(tmp_path) -> None:
    source = tmp_path / "paimana_2026_04.csv"
    source.write_text(
        "project_code,project_name,reporting_period,source_filename\n"
        ' P-1 ," A\nProject ",2026-04,FlashReport_April2026.pdf\n',
        encoding="utf-8",
    )
    output, rows_read, rejected = clean_file(source, tmp_path / "processed")
    row = next(csv.DictReader(output.open(encoding="utf-8")))
    assert rows_read == 1
    assert rejected == 0
    assert row["reporting_period"] == "2026-04"
    assert row["source_filename"] == "FlashReport_April2026.pdf"
    assert row["project_code"] == "P-1"


def test_no_fabricated_values() -> None:
    row = clean_row({"project_code": "P-1", "project_name": "Project", "expected_progress": "99", "revised_cost": "unknown"})
    assert row["revised_cost"] is None
    assert "expected_progress" not in row