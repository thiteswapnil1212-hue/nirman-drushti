from uuid import UUID

from pydantic import BaseModel, Field


class AssistantRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class AssistantAnswer(BaseModel):
    answer: str
    key_points: list[str]
    evidence_used: list[str]
    data_limitations: list[str]


class AssistantResponse(AssistantAnswer):
    project_id: UUID
    model: str
    grounded: bool
