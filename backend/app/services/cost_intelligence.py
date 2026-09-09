from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.schemas.cost_prediction import CostRevisionPrediction
from app.schemas.project import CostIntelligenceResponse
from app.services.cost_prediction import predict_project
from app.services.projects import get_project, get_project_history


def calculate_current_cost_assessment(
    original_cost: Decimal | None,
    revised_current_cost: Decimal | None,
    expenditure: Decimal | None,
) -> dict[str, Decimal | bool | None]:
    """Apply the MoSPI ongoing-project calculation without imputing missing values."""
    escalation_amount = None
    escalation_percentage = None
    expenditure_percentage = None
    current_cost_overrun_amount = None
    current_cost_overrun_percentage = None
    amount_above_revised_cost = None
    expenditure_exceeds_revised_cost = None

    if original_cost is not None and revised_current_cost is not None:
        escalation_amount = revised_current_cost - original_cost
        if original_cost > 0:
            escalation_percentage = (escalation_amount / original_cost) * 100

    if revised_current_cost is not None and expenditure is not None:
        expenditure_exceeds_revised_cost = expenditure > revised_current_cost
        expenditure_percentage = (
            (expenditure / revised_current_cost) * 100
            if revised_current_cost > 0
            else None
        )
        if original_cost is not None:
            if expenditure <= revised_current_cost:
                current_cost_overrun_amount = revised_current_cost - original_cost
            else:
                current_cost_overrun_amount = expenditure - original_cost
                amount_above_revised_cost = expenditure - revised_current_cost
            if original_cost > 0:
                current_cost_overrun_percentage = (
                    current_cost_overrun_amount / original_cost
                ) * 100

    return {
        "escalation_amount": escalation_amount,
        "escalation_percentage": escalation_percentage,
        "expenditure_percentage": expenditure_percentage,
        "current_cost_overrun_amount": current_cost_overrun_amount,
        "current_cost_overrun_percentage": current_cost_overrun_percentage,
        "amount_above_revised_cost": amount_above_revised_cost,
        "expenditure_exceeds_revised_cost": expenditure_exceeds_revised_cost,
    }


def build_cost_intelligence(database: Session, project_id: UUID) -> CostIntelligenceResponse:
    project = get_project(database, project_id)
    _, costs = get_project_history(database, project_id)
    costs = sorted(costs, key=lambda item: (item.recorded_at, item.id))

    original_cost = project.original_cost
    revised_current_cost = project.current_cost
    expenditure = project.expenditure
    if costs:
        latest = costs[-1]
        original_cost = original_cost if original_cost is not None else latest.original_cost
        revised_current_cost = revised_current_cost if revised_current_cost is not None else latest.current_cost
        expenditure = expenditure if expenditure is not None else latest.expenditure

    calculation = calculate_current_cost_assessment(
        original_cost,
        revised_current_cost,
        expenditure,
    )
    limitations: list[str] = []
    if original_cost is None or revised_current_cost is None:
        limitations.append("Original and revised/current costs are required for the current cost assessment.")
    if expenditure is None:
        limitations.append("Cumulative expenditure is unavailable, so the MoSPI branch comparison cannot be completed.")
    limitations.append("Validated completion cost is not present in the current project record; completion-cost overrun is unavailable.")

    prediction = predict_project(database, project_id)
    availability = "AVAILABLE" if original_cost is not None and revised_current_cost is not None else "INSUFFICIENT_DATA"
    return CostIntelligenceResponse(
        project_id=project_id,
        availability=availability,
        original_cost=original_cost,
        revised_current_cost=revised_current_cost,
        expenditure=expenditure,
        **calculation,
        completion_cost_availability="UNAVAILABLE",
        completion_cost_overrun_amount=None,
        completion_cost_overrun_percentage=None,
        prediction=prediction,
        limitations=limitations,
    )
