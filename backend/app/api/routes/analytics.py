from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("")
def portfolio_analytics() -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Analytics API is not implemented yet.")
