from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.risk import RiskSummaryResponse
from app.services.analytics import AnalyticsFilters
from app.services.risk import build_risk_summary

router = APIRouter()


@router.get("", response_model=RiskSummaryResponse)
@router.get("/summary", response_model=RiskSummaryResponse)
def risk_summary(
    database: Session = Depends(get_db),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
) -> RiskSummaryResponse:
    return build_risk_summary(database, AnalyticsFilters(state=state, ministry=ministry, sector=sector, implementing_agency=implementing_agency))
