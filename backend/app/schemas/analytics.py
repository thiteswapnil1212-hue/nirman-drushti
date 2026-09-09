from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


DataClass = Literal["reported", "derived", "unavailable"]
Availability = Literal["available", "insufficient_observations", "unavailable"]


class AnalyticsMetric(BaseModel):
    value: Decimal | None = None
    classification: DataClass
    available: bool
    reason: str | None = None


class AnalyticsNotice(BaseModel):
    availability: Availability
    reason: str | None = None


class PortfolioSummary(BaseModel):
    project_count: int
    projects_with_cost: int
    projects_with_progress: int
    reported_original_cost: AnalyticsMetric
    reported_current_cost: AnalyticsMetric
    reported_expenditure: AnalyticsMetric
    reported_average_progress: AnalyticsMetric
    derived_cost_escalation_amount: AnalyticsMetric
    derived_cost_escalation_percentage: AnalyticsMetric
    derived_expenditure_percentage: AnalyticsMetric
    derived_schedule_extensions: AnalyticsMetric
    risk_status: AnalyticsNotice


class CostGroup(BaseModel):
    group: str
    project_count: int
    reported_original_cost: Decimal | None = None
    reported_current_cost: Decimal | None = None
    reported_expenditure: Decimal | None = None
    derived_escalation_amount: Decimal | None = None
    derived_escalation_percentage: Decimal | None = None


class CostAnalytics(BaseModel):
    group_by: str
    groups: list[CostGroup]
    notice: AnalyticsNotice


class TrendPoint(BaseModel):
    reporting_period: date
    reported_current_cost: Decimal | None = None
    reported_expenditure: Decimal | None = None
    reported_physical_progress: Decimal | None = None
    observation_count: int


class HeatmapCell(BaseModel):
    group: str
    reporting_period: date
    observation_count: int
    average_progress: Decimal | None = None


class TrendAnalytics(BaseModel):
    points: list[TrendPoint]
    heatmap: list[HeatmapCell]
    notice: AnalyticsNotice


class CompositionItem(BaseModel):
    label: str
    count: int
    percentage: Decimal | None = None


class CompositionAnalytics(BaseModel):
    category: str
    items: list[CompositionItem]
    notice: AnalyticsNotice


class HistogramBin(BaseModel):
    lower: Decimal
    upper: Decimal
    count: int


class ScatterPoint(BaseModel):
    project_id: str
    project_name: str
    physical_progress: Decimal | None = None
    expenditure_percentage: Decimal | None = None
    escalation_percentage: Decimal | None = None


class BoxPlotGroup(BaseModel):
    group: str
    count: int
    minimum: Decimal | None = None
    lower_quartile: Decimal | None = None
    median: Decimal | None = None
    upper_quartile: Decimal | None = None
    maximum: Decimal | None = None


class DistributionAnalytics(BaseModel):
    escalation_histogram: list[HistogramBin]
    progress_histogram: list[HistogramBin]
    scatter: list[ScatterPoint]
    box_plot: list[BoxPlotGroup]
    notice: AnalyticsNotice


class BenchmarkRow(BaseModel):
    rank: int
    group: str
    project_count: int
    average_progress: Decimal | None = None
    average_expenditure_percentage: Decimal | None = None
    average_escalation_percentage: Decimal | None = None


class BenchmarkingAnalytics(BaseModel):
    group_by: str
    rows: list[BenchmarkRow]
    notice: AnalyticsNotice


class PortfolioAnalyticsResponse(BaseModel):
    summary: PortfolioSummary
    cost: CostAnalytics
    trends: TrendAnalytics
    composition: CompositionAnalytics
    distributions: DistributionAnalytics
    benchmarking: BenchmarkingAnalytics
