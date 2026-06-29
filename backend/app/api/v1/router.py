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
from app.modules.adapters.api.routes import router as adapters_router
from app.modules.agent_runtime.api.routes import router as agent_runs_router
from app.modules.agents.api.routes import router as agents_router
from app.modules.applications.api.routes import router as applications_router
from app.modules.assets.api.routes import router as assets_router
from app.modules.audit_trace.api.routes import router as audit_trace_router
from app.modules.blueprints.api.routes import router as blueprints_router
from app.modules.discovery.api.routes import router as discovery_router
from app.modules.knowledge_graph.api.routes import router as knowledge_graphs_router
from app.modules.ontology.api.routes import router as ontologies_router
from app.modules.products.api.routes import router as products_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, prefix="/health", tags=["health"])
api_v1_router.include_router(applications_router, prefix="/applications", tags=["applications"])
api_v1_router.include_router(
    discovery_router,
    prefix="/discovery-sessions",
    tags=["discovery"],
)
api_v1_router.include_router(blueprints_router, prefix="/blueprints", tags=["blueprints"])
api_v1_router.include_router(assets_router, prefix="/assets", tags=["assets"])
api_v1_router.include_router(
    audit_trace_router,
    prefix="/audit-traces",
    tags=["audit-traces"],
)
api_v1_router.include_router(products_router, prefix="/products", tags=["products"])
api_v1_router.include_router(agents_router, prefix="/agents", tags=["agents"])
api_v1_router.include_router(ontologies_router, prefix="/ontologies", tags=["ontologies"])
api_v1_router.include_router(
    knowledge_graphs_router,
    prefix="/knowledge-graphs",
    tags=["knowledge-graphs"],
)
api_v1_router.include_router(adapters_router, prefix="/adapters", tags=["adapters"])
api_v1_router.include_router(agent_runs_router, prefix="/agent-runs", tags=["agent-runs"])
