from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.project import CostHistory, ProgressHistory, Project, ProjectStatus
from app.schemas.project import (
    ProjectCreate, 
    ProjectUpdate,
    ProjectIntelligenceResponse,
    CostIntelligence,
    ProgressIntelligence,
    ScheduleIntelligence,
    DataQuality
)

class DuplicateProjectCodeError(Exception):
    """Raised when a project code already exists."""


class ProjectNotFoundError(Exception):
    """Raised when a project does not exist."""


def list_projects(
    database: Session,
    *,
    page: int,
    page_size: int,
    status: ProjectStatus | None = None,
    sector: str | None = None,
    ministry: str | None = None,
    search: str | None = None,
    state: str | None = None,
    implementing_agency: str | None = None,
) -> tuple[list[Project], int]:
    filters = []
    if status is not None:
        filters.append(Project.status == status)
    if sector is not None:
        filters.append(Project.sector == sector)
    if ministry is not None:
        filters.append(Project.ministry == ministry)
    if search is not None:
        filters.append(Project.name.istartswith(search))
    if state is not None:
        filters.append(Project.state == state)
    if implementing_agency is not None:
        filters.append(Project.implementing_agency == implementing_agency)

    total = database.scalar(select(func.count(Project.id)).where(*filters)) or 0
    statement = (
        select(Project)
        .where(*filters)
        .order_by(Project.project_identity.asc().nulls_last(), Project.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(database.scalars(statement).all()), total


def get_project_history(database: Session, project_id: UUID) -> tuple[list[ProgressHistory], list[CostHistory]]:
    if get_project(database, project_id) is None:
        raise ProjectNotFoundError
    progress = list(
        database.scalars(
            select(ProgressHistory)
            .where(ProgressHistory.project_id == project_id)
            .order_by(ProgressHistory.reporting_period.asc(), ProgressHistory.id.asc())
        ).all()
    )
    costs = list(
        database.scalars(
            select(CostHistory)
            .where(CostHistory.project_id == project_id)
            .order_by(CostHistory.recorded_at.asc(), CostHistory.id.asc())
        ).all()
    )
    return progress, costs


def get_project(database: Session, project_id: UUID) -> Project:
    project = database.get(Project, project_id)
    if project is None:
        raise ProjectNotFoundError
    return project


def create_project(database: Session, payload: ProjectCreate) -> Project:
    project = Project(**payload.model_dump())
    database.add(project)
    try:
        database.commit()
    except IntegrityError as error:
        database.rollback()
        if "project_code" in str(error.orig):
            raise DuplicateProjectCodeError from error
        raise
    database.refresh(project)
    return project


def update_project(database: Session, project_id: UUID, payload: ProjectUpdate) -> Project:
    project = get_project(database, project_id)
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(project, field, value)
    database.add(project)
    try:
        database.commit()
    except IntegrityError as error:
        database.rollback()
        if "project_code" in str(error.orig):
            raise DuplicateProjectCodeError from error
        raise
    database.refresh(project)
    return project


def calculate_project_intelligence(database: Session, project_id: UUID) -> ProjectIntelligenceResponse:
    project = get_project(database, project_id)
    progress, costs = get_project_history(database, project_id)
    costs = sorted(costs, key=lambda item: (item.recorded_at, item.id))

    # ------------------------------------------------------------------------
    # 1. Cost Intelligence
    # ------------------------------------------------------------------------
    latest_cost_val = project.current_cost
    original_cost_val = project.original_cost
    expenditure = project.expenditure
    
    # Check if we have cost history to find a more precise latest cost if current_cost is missing
    if costs:
        latest_history = costs[-1]
        if latest_cost_val is None:
            latest_cost_val = latest_history.current_cost
        if original_cost_val is None:
            original_cost_val = latest_history.original_cost
        if expenditure is None:
            expenditure = latest_history.expenditure

    absolute_increase = None
    escalation_pct = None

    if latest_cost_val is not None and original_cost_val is not None:
        absolute_increase = latest_cost_val - original_cost_val
        if original_cost_val > 0:
            escalation_pct = (absolute_increase / original_cost_val) * 100

    expenditure_pct = None
    if expenditure is not None and latest_cost_val is not None and latest_cost_val > 0:
        expenditure_pct = (expenditure / latest_cost_val) * 100

    cost_intel = CostIntelligence(
        original_cost=original_cost_val,
        latest_cost=latest_cost_val,
        absolute_increase=absolute_increase,
        escalation_percentage=escalation_pct,
        expenditure=expenditure,
        escalation_amount=absolute_increase,
        cumulative_expenditure=expenditure,
        expenditure_percentage=expenditure_pct,
        historical_observations=costs,
    )

    # ------------------------------------------------------------------------
    # 2. Progress Intelligence
    # ------------------------------------------------------------------------
    latest_progress = None
    previous_progress = None
    progress_change = None
    trend = None
    obs_count = len(progress)

    if obs_count >= 1:
        latest_progress = progress[-1].physical_progress

    if obs_count >= 2:
        previous_progress = progress[-2].physical_progress
        if latest_progress is not None and previous_progress is not None:
            progress_change = latest_progress - previous_progress
            if progress_change > 0:
                trend = "INCREASING"
            elif progress_change < 0:
                trend = "DECLINING"
            else:
                trend = "FLAT"

    progress_intel = ProgressIntelligence(
        latest_progress=latest_progress,
        previous_progress=previous_progress,
        progress_change=progress_change,
        trend=trend,
        observation_count=obs_count,
    )

    # ------------------------------------------------------------------------
    # 3. Schedule Intelligence
    # ------------------------------------------------------------------------
    planned = project.planned_completion_date
    expected = project.expected_completion_date
    ext_days = None
    ext_months = None
    has_ext = None

    if planned and expected:
        diff = expected - planned
        ext_days = diff.days
        if ext_days > 0:
            has_ext = True
            ext_months = round(ext_days / 30.44, 1)
        else:
            has_ext = False
            ext_days = 0
            ext_months = 0.0

    schedule_intel = ScheduleIntelligence(
        planned_completion=planned,
        expected_completion=expected,
        extension_days=ext_days,
        extension_months=ext_months,
        has_extension=has_ext,
    )

    # ------------------------------------------------------------------------
    # 4. Data Quality
    # ------------------------------------------------------------------------
    sufficient_history = obs_count >= 2
    available = []
    if latest_cost_val is not None:
        available.append("latest_cost")
    if original_cost_val is not None:
        available.append("original_cost")
    if latest_progress is not None:
        available.append("latest_progress")
    if planned is not None:
        available.append("planned_completion_date")
    if expected is not None:
        available.append("expected_completion_date")

    dq_intel = DataQuality(
        sufficient_history=sufficient_history,
        available_fields=available,
    )

    return ProjectIntelligenceResponse(
        cost=cost_intel,
        progress=progress_intel,
        schedule=schedule_intel,
        data_quality=dq_intel,
    )
