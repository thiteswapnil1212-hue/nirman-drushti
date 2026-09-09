from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.analytics import (
    BenchmarkingAnalytics,
    CompositionAnalytics,
    CostAnalytics,
    DistributionAnalytics,
    PortfolioAnalyticsResponse,
    PortfolioSummary,
    TrendAnalytics,
)
from app.services.analytics import AnalyticsFilters, build_portfolio_analytics

router = APIRouter()


def _build(
    database: Session,
    reporting_period: date | None,
    state: str | None,
    ministry: str | None,
    sector: str | None,
    implementing_agency: str | None,
    group_by: str = "implementing_agency",
    category: str = "implementing_agency",
) -> PortfolioAnalyticsResponse:
    try:
        return build_portfolio_analytics(
            database,
            AnalyticsFilters(reporting_period, state, ministry, sector, implementing_agency),
            group_by=group_by,
            category=category,
        )
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error)) from error


@router.get("", response_model=PortfolioAnalyticsResponse)
def portfolio_analytics(
    database: Session = Depends(get_db),
    reporting_period: date | None = Query(default=None),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
    group_by: str = Query(default="implementing_agency"),
    category: str = Query(default="implementing_agency"),
) -> PortfolioAnalyticsResponse:
    return _build(database, reporting_period, state, ministry, sector, implementing_agency, group_by, category)


@router.get("/summary", response_model=PortfolioSummary)
def portfolio_summary(
    database: Session = Depends(get_db),
    reporting_period: date | None = Query(default=None),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
) -> PortfolioSummary:
    return _build(database, reporting_period, state, ministry, sector, implementing_agency).summary


@router.get("/cost", response_model=CostAnalytics)
def cost_analytics(
    database: Session = Depends(get_db),
    reporting_period: date | None = Query(default=None),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
    group_by: str = Query(default="implementing_agency"),
) -> CostAnalytics:
    return _build(database, reporting_period, state, ministry, sector, implementing_agency, group_by).cost


@router.get("/trends", response_model=TrendAnalytics)
def portfolio_trends(
    database: Session = Depends(get_db),
    reporting_period: date | None = Query(default=None),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
) -> TrendAnalytics:
    return _build(database, reporting_period, state, ministry, sector, implementing_agency).trends


@router.get("/composition", response_model=CompositionAnalytics)
def portfolio_composition(
    database: Session = Depends(get_db),
    reporting_period: date | None = Query(default=None),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
    category: str = Query(default="implementing_agency"),
) -> CompositionAnalytics:
    return _build(database, reporting_period, state, ministry, sector, implementing_agency, category=category).composition


@router.get("/distributions", response_model=DistributionAnalytics)
def portfolio_distributions(
    database: Session = Depends(get_db),
    reporting_period: date | None = Query(default=None),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
) -> DistributionAnalytics:
    return _build(database, reporting_period, state, ministry, sector, implementing_agency).distributions


@router.get("/benchmarking", response_model=BenchmarkingAnalytics)
def portfolio_benchmarking(
    database: Session = Depends(get_db),
    reporting_period: date | None = Query(default=None),
    state: str | None = Query(default=None, min_length=1),
    ministry: str | None = Query(default=None, min_length=1),
    sector: str | None = Query(default=None, min_length=1),
    implementing_agency: str | None = Query(default=None, min_length=1),
    group_by: str = Query(default="implementing_agency"),
) -> BenchmarkingAnalytics:
    return _build(database, reporting_period, state, ministry, sector, implementing_agency, group_by).benchmarking
