from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.schemas.actions import ProjectAction, ProjectActionsResponse
from app.services.projects import get_project
from app.services.risk import build_risk_assessment
from app.services.warnings import build_project_warnings


def build_project_actions(database: Session, project_id: UUID) -> ProjectActionsResponse:
    project = get_project(database, project_id)
    risk_assessment = build_risk_assessment(database, project_id)
    warnings = build_project_warnings(database, project_id)

    actions: list[ProjectAction] = []
    action_ids: set[str] = set()

    warning_map = {w.type: w for w in warnings}

    # 1. Cost Escalation Action
    cost_warning = warning_map.get("COST_ESCALATION")
    has_cost_escalation = False
    cost_diff = Decimal("0")
    cost_pct = Decimal("0")

    if project.original_cost and project.current_cost and project.current_cost > project.original_cost:
        has_cost_escalation = True
        cost_diff = project.current_cost - project.original_cost
        cost_pct = (cost_diff / project.original_cost) * Decimal("100")

    if cost_warning or has_cost_escalation:
        priority = "CRITICAL" if (cost_pct >= Decimal("20") or (cost_warning and cost_warning.severity == "CRITICAL")) else "HIGH"
        orig_fmt = f"₹{project.original_cost.quantize(Decimal('0.01'))} Cr" if project.original_cost else "N/A"
        curr_fmt = f"₹{project.current_cost.quantize(Decimal('0.01'))} Cr" if project.current_cost else "N/A"
        diff_fmt = f"₹{cost_diff.quantize(Decimal('0.01'))} Cr"
        pct_fmt = f"{cost_pct.quantize(Decimal('0.1'))}%"

        action_id = "ACTION_COST_ESCALATION"
        if action_id not in action_ids:
            action_ids.add(action_id)
            actions.append(
                ProjectAction(
                    action_id=action_id,
                    priority=priority,
                    title="Review Approved Cost Revision and Scope Changes",
                    reason=f"Reported current cost of {curr_fmt} exceeds original approved baseline of {orig_fmt} by {pct_fmt} ({diff_fmt}).",
                    evidence=f"Original approved cost: {orig_fmt} | Latest current cost: {curr_fmt}.",
                    recommended_check="Verify administrative approvals, revised sanction orders, and scope expansion records.",
                    source="COST_ENGINE",
                )
            )

    # 2. Schedule Extension Action
    sched_warning = warning_map.get("SCHEDULE_EXTENSION")
    has_sched_extension = False

    if project.planned_completion_date and project.expected_completion_date and project.expected_completion_date > project.planned_completion_date:
        has_sched_extension = True

    if sched_warning or has_sched_extension:
        priority = "CRITICAL" if (sched_warning and sched_warning.severity == "CRITICAL") else "HIGH"
        planned_str = project.planned_completion_date.strftime("%d-%b-%Y") if project.planned_completion_date else "N/A"
        expected_str = project.expected_completion_date.strftime("%d-%b-%Y") if project.expected_completion_date else "N/A"

        action_id = "ACTION_SCHEDULE_EXTENSION"
        if action_id not in action_ids:
            action_ids.add(action_id)
            actions.append(
                ProjectAction(
                    action_id=action_id,
                    priority=priority,
                    title="Verify Revised Completion Commitment and Critical Path",
                    reason=f"Expected completion date ({expected_str}) extends beyond the initial planned target date ({planned_str}).",
                    evidence=f"Planned target completion: {planned_str} | Expected completion: {expected_str}.",
                    recommended_check="Review site clearance, land acquisition status, contractor deployment, and critical path milestones.",
                    source="SCHEDULE_ENGINE",
                )
            )

    # 3. Expenditure / Progress Divergence Action
    div_warning = warning_map.get("EXPENDITURE_PROGRESS_DIVERGENCE")
    has_divergence = False
    exp_pct = Decimal("0")
    phys_pct = Decimal("0")

    if project.current_cost and project.current_cost > Decimal("0") and project.expenditure is not None:
        exp_pct = (project.expenditure / project.current_cost) * Decimal("100")

    if project.physical_progress is not None:
        phys_pct = project.physical_progress

    if exp_pct > phys_pct + Decimal("15.0"):
        has_divergence = True

    if div_warning or has_divergence:
        priority = "HIGH" if (div_warning and div_warning.severity in ("HIGH", "CRITICAL")) else "MODERATE"
        exp_fmt = f"₹{project.expenditure.quantize(Decimal('0.01'))} Cr" if project.expenditure is not None else "N/A"
        exp_pct_fmt = f"{exp_pct.quantize(Decimal('0.1'))}%"
        phys_pct_fmt = f"{phys_pct.quantize(Decimal('0.1'))}%"

        action_id = "ACTION_EXPENDITURE_DIVERGENCE"
        if action_id not in action_ids:
            action_ids.add(action_id)
            actions.append(
                ProjectAction(
                    action_id=action_id,
                    priority=priority,
                    title="Verify Financial Discrepancy vs Physical Milestones",
                    reason=f"Cumulative financial expenditure rate ({exp_pct_fmt}) significantly leads physical progress ({phys_pct_fmt}).",
                    evidence=f"Cumulative expenditure: {exp_fmt} ({exp_pct_fmt} of current cost) | Physical progress: {phys_pct_fmt}.",
                    recommended_check="Audit billing milestones, unadjusted mobilization advances, and physical measurement certificates.",
                    source="DIVERGENCE_ENGINE",
                )
            )

    # 4. Progress Slowdown Action
    slow_warning = warning_map.get("PROGRESS_SLOWDOWN")
    progress_risk_factor = next((f for f in risk_assessment.factors if f.factor == "Progress vs expected schedule"), None)
    has_progress_pressure = progress_risk_factor and progress_risk_factor.severity in ("HIGH", "CRITICAL")

    if slow_warning or has_progress_pressure:
        priority = "HIGH" if (slow_warning and slow_warning.severity in ("HIGH", "CRITICAL")) else "MODERATE"
        phys_pct_fmt = f"{project.physical_progress.quantize(Decimal('0.1'))}%" if project.physical_progress is not None else "N/A"

        action_id = "ACTION_PROGRESS_SLOWDOWN"
        if action_id not in action_ids:
            action_ids.add(action_id)
            actions.append(
                ProjectAction(
                    action_id=action_id,
                    priority=priority,
                    title="Inspect Work Execution and Site Activity Rates",
                    reason="Physical progress rate is trailing behind expected schedule timeline progress.",
                    evidence=f"Reported physical progress: {phys_pct_fmt} against schedule elapsed duration.",
                    recommended_check="Conduct physical verification of work on site and evaluate contractor manpower/equipment mobilization.",
                    source="PROGRESS_ENGINE",
                )
            )

    # 5. Data Quality Gap Action
    dq_warning = warning_map.get("DATA_QUALITY")
    missing_fields = []
    if project.original_cost is None:
        missing_fields.append("original_cost")
    if project.current_cost is None:
        missing_fields.append("current_cost")
    if project.expenditure is None:
        missing_fields.append("expenditure")
    if project.physical_progress is None:
        missing_fields.append("physical_progress")
    if project.planned_completion_date is None:
        missing_fields.append("planned_completion_date")
    if project.expected_completion_date is None:
        missing_fields.append("expected_completion_date")

    is_insufficient_data = risk_assessment.availability == "INSUFFICIENT_DATA"

    if dq_warning or missing_fields or is_insufficient_data:
        priority = "HIGH" if is_insufficient_data else "MODERATE"
        reason = "Project profile or observation history contains unpopulated reporting attributes."
        if is_insufficient_data:
            reason = "Insufficient historical observation data available for comprehensive risk and prediction calculations."
        
        evidence_str = f"Missing reporting attributes: {', '.join(missing_fields)}" if missing_fields else "Incomplete PAIMANA observation history."

        action_id = "ACTION_DATA_QUALITY"
        if action_id not in action_ids:
            action_ids.add(action_id)
            actions.append(
                ProjectAction(
                    action_id=action_id,
                    priority=priority,
                    title="Update Missing Reporting Fields and Observation History",
                    reason=reason,
                    evidence=evidence_str,
                    recommended_check="Reconcile PAIMANA reporting entries and submit complete milestone progress data.",
                    source="DATA_QUALITY_ENGINE",
                )
            )

    return ProjectActionsResponse(
        project_id=project_id,
        actions=actions,
        action_count=len(actions),
    )
