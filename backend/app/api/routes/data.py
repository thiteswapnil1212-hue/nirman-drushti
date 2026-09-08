from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("")
def data_status() -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Data ingestion API is not implemented yet.")
