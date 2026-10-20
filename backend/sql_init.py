"""
Database Initialization & Safe Seeding Engine for MES Production System
Provides backward-compatible and direct access to init_mes_database.

CORE SAFETY GUARANTEES:
1. PREVENT STARTUP DATA OVERWRITE:
   - Check if dbo.Material_Stock already contains rows.
   - DO NOT run any UPDATE, TRUNCATE, or default INSERT on dbo.Material_Stock if the table already has records.
   - Only seed initial demo stock if SELECT COUNT(*) FROM dbo.Material_Stock is exactly 0.
"""
import sys
import os
import logging

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

logger = logging.getLogger("SQL_Init")

try:
    from .init_sql import init_mes_database, find_working_server, CANDIDATE_SERVERS
except (ImportError, ValueError):
    from init_sql import init_mes_database, find_working_server, CANDIDATE_SERVERS

__all__ = ["init_mes_database", "find_working_server", "CANDIDATE_SERVERS"]

if __name__ == "__main__":
    init_mes_database()
