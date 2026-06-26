"""API v1 router assembly and module registration pattern.

Module router registration pattern
----------------------------------
Each canonical module exposes an ``APIRouter`` from
``app.modules.<module_name>.api.routes``. Register module routers here when
implementing module features (API-003 — modules own their API surface):

    from app.modules.applications.api.routes import router as applications_router

    api_v1_router.include_router(
        applications_router,
        prefix="/applications",
        tags=["applications"],
    )

Guidelines:
- Platform-wide routes (health, future metadata) live under ``app.api.v1``.
- Business routes belong in the owning module's ``api/routes.py``.
- Do not register a module router for assets owned by another module.
- Prefix paths must match ``SIP_API_Boundary_v1`` (e.g. ``/discovery-sessions``).
"""

from fastapi import APIRouter

from app.api.v1.health import router as health_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, prefix="/health", tags=["health"])

# Future module routers (uncomment when module routes are implemented):
#
# from app.modules.applications.api.routes import router as applications_router
# api_v1_router.include_router(applications_router, prefix="/applications", tags=["applications"])
#
# from app.modules.discovery.api.routes import router as discovery_router
# api_v1_router.include_router(discovery_router, prefix="/discovery-sessions", tags=["discovery"])
