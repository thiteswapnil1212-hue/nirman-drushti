from fastapi import APIRouter

from app.api.routes import analytics, cost, data, projects, risk, warnings

api_router = APIRouter()
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(risk.router, prefix="/risk", tags=["risk"])
api_router.include_router(cost.router, prefix="/cost", tags=["cost"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(data.router, prefix="/data", tags=["data"])
api_router.include_router(warnings.router, prefix="/warnings", tags=["warnings"])
