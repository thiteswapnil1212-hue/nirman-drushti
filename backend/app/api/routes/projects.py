from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.project import ProjectStatus
from app.schemas.project import ProjectCreate, ProjectHistoryResponse, ProjectPage, ProjectResponse, ProjectUpdate, ProjectIntelligenceResponse, CostIntelligenceResponse
from app.schemas.risk import RiskAssessment
from app.schemas.warnings import EarlyWarning
from app.schemas.cost_prediction import CostRevisionPrediction
from app.schemas.schedule_prediction import ScheduleRevisionPrediction
from app.schemas.actions import ProjectActionsResponse
from app.services.projects import (
    DuplicateProjectCodeError,
    ProjectNotFoundError,
    create_project,
    get_project,
    list_projects,
    get_project_history,
    update_project,
    calculate_project_intelligence,
)
from app.services.risk import build_risk_assessment
from app.services.warnings import build_project_warnings
from app.services.cost_prediction import predict_project
from app.services.schedule_prediction import predict_project as predict_schedule_project
from app.services.project_actions import build_project_actions
from app.services.cost_intelligence import build_cost_intelligence


router = APIRouter()


@router.get("", response_model=ProjectPage)
def read_projects(
    database: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    project_status: ProjectStatus | None = Query(default=None, alias="status"),
    sector: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    search: str | None = Query(default=None, min_length=1),
    state: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
) -> ProjectPage:
    projects, total = list_projects(
        database,
        page=page,
        page_size=page_size,
        status=project_status,
        sector=sector,
        ministry=ministry,
        search=search,
        state=state,
        implementing_agency=implementing_agency,
    )
    return ProjectPage(items=projects, total=total, page=page, page_size=page_size)


@router.get("/{project_id}/history", response_model=ProjectHistoryResponse)
def read_project_history(project_id: UUID, database: Session = Depends(get_db)) -> ProjectHistoryResponse:
    try:
        progress, costs = get_project_history(database, project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error
    return ProjectHistoryResponse(progress=progress, costs=costs)


@router.get("/{project_id}/intelligence", response_model=ProjectIntelligenceResponse)
def read_project_intelligence(project_id: UUID, database: Session = Depends(get_db)) -> ProjectIntelligenceResponse:
    try:
        return calculate_project_intelligence(database, project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error


@router.get("/{project_id}/risk", response_model=RiskAssessment)
def read_project_risk(project_id: UUID, database: Session = Depends(get_db)) -> RiskAssessment:
    try:
        return build_risk_assessment(database, project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error


@router.get("/{project_id}/warnings", response_model=list[EarlyWarning])
def read_project_warnings(project_id: UUID, database: Session = Depends(get_db)) -> list[EarlyWarning]:
    try:
        return build_project_warnings(database, project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error


@router.get("/{project_id}/prediction/cost", response_model=CostRevisionPrediction)
def read_cost_revision_prediction(project_id: UUID, database: Session = Depends(get_db)) -> CostRevisionPrediction:
    try:
        return predict_project(database, project_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error


@router.get("/{project_id}/cost-intelligence", response_model=CostIntelligenceResponse)
def read_cost_intelligence(project_id: UUID, database: Session = Depends(get_db)) -> CostIntelligenceResponse:
    try:
        return build_cost_intelligence(database, project_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error


@router.get("/{project_id}/prediction/schedule", response_model=ScheduleRevisionPrediction)
def read_schedule_revision_prediction(project_id: UUID, database: Session = Depends(get_db)) -> ScheduleRevisionPrediction:
    try:
        return predict_schedule_project(database, project_id)
    except LookupError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error


@router.get("/{project_id}/actions", response_model=ProjectActionsResponse)
def read_project_actions(project_id: UUID, database: Session = Depends(get_db)) -> ProjectActionsResponse:
    try:
        return build_project_actions(database, project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error


@router.get("/{project_id}", response_model=ProjectResponse)
def read_project(project_id: UUID, database: Session = Depends(get_db)) -> ProjectResponse:
    try:
        return get_project(database, project_id)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def add_project(payload: ProjectCreate, database: Session = Depends(get_db)) -> ProjectResponse:
    try:
        return create_project(database, payload)
    except DuplicateProjectCodeError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="project_code already exists") from error
    except IntegrityError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project violates a database constraint") from error


@router.patch("/{project_id}", response_model=ProjectResponse)
def patch_project(project_id: UUID, payload: ProjectUpdate, database: Session = Depends(get_db)) -> ProjectResponse:
    try:
        return update_project(database, project_id, payload)
    except ProjectNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from error
    except DuplicateProjectCodeError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="project_code already exists") from error
    except IntegrityError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Project violates a database constraint") from error
