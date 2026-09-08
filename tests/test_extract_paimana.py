from ml.data_pipeline.extract_paimana import (
    find_table6,
    parse_numeric,
    parse_revised_value,
    parse_table6_rows,
    reporting_period_from_filename,
)


def test_reporting_period_from_filename() -> None:
    assert reporting_period_from_filename("FlashReport_April2026.pdf") == "2026-04"


def test_numeric_parsing() -> None:
    assert parse_numeric("1,234.50 Crore") == "1234.50"


def test_missing_dash_is_null() -> None:
    assert parse_numeric("-") is None


def test_revised_value_parsing() -> None:
    assert parse_revised_value("10.00 (12.50)") == "12.50"


def test_basic_table6_row_parsing() -> None:
    pages = ["Table 6: All Ongoing Projects\nSl.No | Project Name | Agency | Project Code | Legacy OCMS Code | PMGID | State | Start Date | Original DoC | Revised DoC | Original Cost | Revised Cost | Cumulative Expenditure | Physical Progress\n1 | River Bridge | Roads Agency | P-1 | O-1 | PMG-1 | State A / State B | 01-04-2020 | 2024 | (2025) | 1,000 | (1,200) | 500 | 50"]
    section = find_table6(pages)
    rows = parse_table6_rows(section.text, "2026-04", "FlashReport_April2026.pdf")
    assert rows[0]["project_name"] == "River Bridge"
    assert rows[0]["revised_doc"] == "2025"
    assert rows[0]["revised_cost"] == "1200"
    assert rows[0]["pmgid"] == "PMG-1"
    assert rows[0]["state"] == "State A / State B"
    assert rows[0]["source_filename"] == "FlashReport_April2026.pdf"


def test_multi_page_table6_rows_skip_repeated_headers() -> None:
    header = "Sl.No | Project Name | Agency | Project Code | Legacy OCMS Code | PMGID | State | Start Date | Original DoC | Revised DoC | Original Cost | Revised Cost | Cumulative Expenditure | Physical Progress"
    page_one = f"{header}\n1 | First project with continuation | Agency One continued | P-1 | OC-1 | PMG-1 | State A | 01/2020 | 12/2024 | (12/2025) | 100 | (120) | 50 | 25"
    page_two = f"All Ongoing Projects\n{header}\n2 | Second project | Agency Two | P-2 | OC-2 | PMG-2 | State B / State C | 02/2021 | 12/2025 | (12/2026) | 200 | (220) | 75 | 35"

    rows = parse_table6_rows("\n".join((page_one, page_two)), "2026-04", "FlashReport_April2026.pdf")

    assert [row["sl_no"] for row in rows] == ["1", "2"]
    assert rows[0]["project_name"] == "First project with continuation"
    assert rows[0]["agency"] == "Agency One continued"
    assert rows[0]["project_code"] == "P-1"
    assert rows[0]["legacy_ocms_code"] == "OC-1"
    assert rows[0]["pmgid"] == "PMG-1"
    assert rows[0]["revised_doc"] == "12/2025"
    assert rows[0]["revised_cost"] == "120"
    assert rows[1]["state"] == "State B / State C"