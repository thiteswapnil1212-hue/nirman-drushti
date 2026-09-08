from datetime import date
from decimal import Decimal

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


def test_project_paimana_fields_are_available_in_model_and_schemas() -> None:
    assert {"state", "legacy_ocms_code", "pmgid"}.issubset(Project.__table__.columns.keys())

    project = ProjectCreate(
        project_code="PRJ-001",
        legacy_ocms_code="OCMS-001",
        pmgid="PMG-001",
        name="Sample project",
        ministry="Infrastructure",
        sector="Transport",
        state="Maharashtra",
        status="ON_TRACK",
        original_cost=Decimal("100.00"),
        current_cost=Decimal("110.00"),
        expenditure=Decimal("25.00"),
        physical_progress=Decimal("20.00"),
        expected_progress=Decimal("25.00"),
        planned_start_date=date(2026, 1, 1),
    )
    update = ProjectUpdate(state="Gujarat", legacy_ocms_code="OCMS-002", pmgid="PMG-002")

    assert project.state == "Maharashtra"
    assert project.legacy_ocms_code == "OCMS-001"
    assert project.pmgid == "PMG-001"
    assert update.state == "Gujarat"
    assert update.legacy_ocms_code == "OCMS-002"
    assert update.pmgid == "PMG-002"