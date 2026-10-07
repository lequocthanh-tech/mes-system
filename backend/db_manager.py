"""
Compatibility Wrapper for db_connector
Delegates connection management and querying directly to backend/db_connector.py
"""

from typing import Optional, List, Dict, Any, Tuple
try:
    from . import db_connector
except (ImportError, ValueError):
    import db_connector

get_db_connection = db_connector.get_connection
verify_mes_database_status = db_connector.verify_mes_database_status
check_db_status = db_connector.check_db_status
execute_query = db_connector.execute_query
execute_transaction = db_connector.execute_transaction
log_user_action = db_connector.log_user_action
log_plc_datalog = db_connector.log_plc_datalog
WINCC_CONN_STR = db_connector.WINCC_CONN_STR
