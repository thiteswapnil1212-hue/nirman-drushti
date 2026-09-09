from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.warnings import WarningListResponse
from app.services.analytics import AnalyticsFilters
from app.services.warnings import build_warning_list

router = APIRouter()


@router.get("", response_model=WarningListResponse)
def early_warnings(
    database: Session = Depends(get_db),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
    severity: str | None = Query(default=None, min_length=1),
    warning_type: str | None = Query(default=None, min_length=1),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
) -> WarningListResponse:
    return build_warning_list(
        database,
        AnalyticsFilters(state=state, ministry=ministry, sector=sector, implementing_agency=implementing_agency),
        severity=severity,
        warning_type=warning_type,
        page=page,
        page_size=page_size,
    )
