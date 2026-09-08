from ml.data_pipeline.match_projects import match_rows


def row(**values: str) -> dict[str, str]:
    return {"reporting_period": "2026-03", "source_filename": "march.csv", **values}


def test_exact_identifier_matching() -> None:
    mappings, reviews = match_rows([row(project_code="P-1", project_name="One", implementing_agency="A", state="S"), row(project_code="P-1", project_name="One updated", implementing_agency="A", state="S", reporting_period="2026-04")])
    assert [item["match_status"] for item in mappings] == ["matched", "matched"]
    assert mappings[0]["project_identity"] == mappings[1]["project_identity"]
    assert not reviews


def test_fallback_matching_requires_all_context() -> None:
    mappings, _ = match_rows([row(project_name="One", implementing_agency="A", state="S"), row(project_name=" One ", implementing_agency="A", state="S", reporting_period="2026-04")])
    assert mappings[0]["match_method"] == "normalized_name_agency_state"
    assert mappings[0]["project_identity"] == mappings[1]["project_identity"]


def test_ambiguous_matching_is_flagged() -> None:
    mappings, reviews = match_rows([
        row(project_code="P-1", project_name="Same", implementing_agency="A", state="S"),
        row(project_code="P-2", project_name="Same", implementing_agency="A", state="S"),
        row(project_name="Same", implementing_agency="A", state="S"),
    ])
    assert mappings[2]["match_status"] == "ambiguous"
    assert reviews[0]["review_reason"] == "conflicting identifier candidates"


def test_duplicate_observations_same_month_are_flagged() -> None:
    mappings, _ = match_rows([row(project_code="P-1", project_name="One"), row(project_code="P-1", project_name="One")])
    assert all(item["duplicate_observation"] == "true" for item in mappings)