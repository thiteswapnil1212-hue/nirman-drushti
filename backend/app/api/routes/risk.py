from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("")
def risk_intelligence() -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Risk intelligence API is not implemented yet.")
