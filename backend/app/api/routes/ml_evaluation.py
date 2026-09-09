from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.ml_evaluation import MLEvaluationResponse
from app.services.ml_evaluation import evaluate_database

router = APIRouter()


@router.get("", response_model=MLEvaluationResponse)
def read_ml_evaluation(database: Session = Depends(get_db)) -> MLEvaluationResponse:
    return evaluate_database(database)
