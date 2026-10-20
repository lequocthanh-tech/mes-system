"""
Unified FastAPI RESTful Backend for MES Production System
Synchronized with Microsoft SQL Server: localhost\\WINCC -> MES_Milk_Production
Unified Entrypoint: re-exports app directly from kepware_gateway so that whether the
system is launched via `python backend/kepware_gateway.py` or `uvicorn main:app`,
100% of background workers (Kepware supervisor, telemetry streamer, historian logger,
Odoo heartbeat) and all routers (db_routes, opc_routes, quality_router, ai_router,
/ws/telemetry) run identically in a single unified process.
"""

import sys
import os

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Canonical singleton FastAPI application with full lifespan & background supervisors
from kepware_gateway import app

# Backward compatibility aliases
try:
    from . import db_routes
    api_router = db_routes.router
except Exception:
    try:
        import db_routes
        api_router = db_routes.router
    except Exception:
        api_router = None

if __name__ == "__main__":
    import uvicorn
    print("[MES_Backend] Starting unified FastAPI SQL Server synchronization engine on http://127.0.0.1:8000")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False, access_log=False)
