"""
Backward-compatibility alias for db_connector.py
"""
import sys
import os

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from .db_connector import (
        get_connection,
        execute_query,
        verify_mes_database_status,
        check_db_status,
        update_tank_stock,
        SQL_SERVER_CONN_STR
    )
except (ImportError, ValueError):
    from db_connector import (
        get_connection,
        execute_query,
        verify_mes_database_status,
        check_db_status,
        update_tank_stock,
        SQL_SERVER_CONN_STR
    )
