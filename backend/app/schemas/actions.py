from typing import Literal
from uuid import UUID

from pydantic import BaseModel


ActionPriority = Literal["CRITICAL", "HIGH", "MODERATE", "INFO"]


class ProjectAction(BaseModel):
    action_id: str
    priority: ActionPriority
    title: str
    reason: str
    evidence: str
    recommended_check: str
    source: str


class ProjectActionsResponse(BaseModel):
    project_id: UUID
    actions: list[ProjectAction]
    action_count: int
