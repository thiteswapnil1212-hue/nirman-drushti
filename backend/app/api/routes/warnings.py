from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("")
def early_warnings() -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Early warnings API is not implemented yet.")
