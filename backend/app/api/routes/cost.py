from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("")
def cost_intelligence() -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Cost intelligence API is not implemented yet.")
