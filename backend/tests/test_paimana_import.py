import csv

from ml.data_pipeline.import_paimana import build_import_plan


def write_csv(path, fields, rows):
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def test_import_plan_preserves_manual_review_and_maps_histories(tmp_path) -> None:
    input_dir = tmp_path / "processed"
    input_dir.mkdir()
    fields = ["sl_no", "project_code", "legacy_ocms_code", "pmgid", "project_name", "state", "implementing_agency", "start_date", "original_completion_date", "revised_completion_date", "original_cost", "revised_cost", "cumulative_expenditure", "physical_progress", "reporting_period", "source_filename"]
    rows = [
        {"sl_no": "1", "project_code": "P-1", "legacy_ocms_code": "", "pmgid": "", "project_name": "Project", "state": "State", "implementing_agency": "Agency", "start_date": "2026-01", "original_completion_date": "2027-01", "revised_completion_date": "", "original_cost": "10", "revised_cost": "", "cumulative_expenditure": "2", "physical_progress": "20", "reporting_period": "2026-03", "source_filename": "march.csv"},
        {"sl_no": "2", "project_code": "", "legacy_ocms_code": "", "pmgid": "", "project_name": "", "state": "", "implementing_agency": "", "start_date": "", "original_completion_date": "", "revised_completion_date": "", "original_cost": "", "revised_cost": "", "cumulative_expenditure": "", "physical_progress": "", "reporting_period": "2026-03", "source_filename": "march.csv"},
    ]
    write_csv(input_dir / "paimana_2026_03.csv", fields, rows)
    mapping_fields = ["observation_id", "project_identity", "match_status", "match_method", "reporting_period", "source_filename", "sl_no", "duplicate_observation"]
    mapping_rows = [
        {"observation_id": "march.csv:1:0", "project_identity": "project-000001", "match_status": "matched", "match_method": "project_code", "reporting_period": "2026-03", "source_filename": "march.csv", "sl_no": "1", "duplicate_observation": "false"},
        {"observation_id": "march.csv:2:1", "project_identity": "", "match_status": "unmatched", "match_method": "", "reporting_period": "2026-03", "source_filename": "march.csv", "sl_no": "2", "duplicate_observation": "false"},
    ]
    mapping = tmp_path / "mapping.csv"
    write_csv(mapping, mapping_fields, mapping_rows)

    plan = build_import_plan(input_dir, mapping)

    assert len(plan.projects) == 1
    assert len(plan.progress_history) == 1
    assert len(plan.cost_history) == 1
    assert plan.observations[1]["match_status"] == "unmatched"
    assert plan.observations[0]["source_filename"] == "march.csv"