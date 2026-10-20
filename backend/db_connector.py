"""
Database Connector Module for MES Production System
Connects to Microsoft SQL Server instance localhost\\WINCC (or .\\WINCC)
Database: MES_Milk_Production
Windows Authentication (Trusted_Connection=yes)
ODBC Driver 17 for SQL Server
"""

import pyodbc
import time
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple

logger = logging.getLogger("DB_Connector")

# Candidate SQL Server instances
CANDIDATE_SERVERS = [
    r"localhost\WINCC",
    r".\WINCC",
    "localhost",
    "."
]

# Supported ODBC Drivers
DRIVERS = [
    "{ODBC Driver 17 for SQL Server}",
    "{ODBC Driver 18 for SQL Server}",
    "{SQL Server Native Client 11.0}",
    "{SQL Server}"
]

DATABASE_NAME = "MES_Milk_Production"

# Cached working parameters
active_server: Optional[str] = None
active_driver: Optional[str] = None

# Circuit Breaker state
db_offline = False
db_last_attempt_time = 0.0
DB_RETRY_COOLDOWN = 5.0  # Retry cooldown in seconds


def get_connection(timeout: int = 3) -> Optional[pyodbc.Connection]:
    """
    Connects to Microsoft SQL Server using candidate instances and drivers.
    Caches working instance for sub-10ms subsequent queries.
    Gracefully handles reconnects if the SQL service restarts.
    """
    global active_server, active_driver, db_offline, db_last_attempt_time

    now = time.time()
    if db_offline and (now - db_last_attempt_time < DB_RETRY_COOLDOWN):
        return None

    db_last_attempt_time = now

    # 1. Try cached configuration first
    if active_server and active_driver:
        try:
            cs = (
                f"DRIVER={active_driver};"
                f"SERVER={active_server};"
                f"DATABASE={DATABASE_NAME};"
                f"Trusted_Connection=yes;"
                f"TrustServerCertificate=yes;"
                f"Connection Timeout={timeout};"
            )
            conn = pyodbc.connect(cs, timeout=timeout)
            db_offline = False
            return conn
        except Exception as e:
            logger.debug(f"Cached connection to {active_server} failed, probing alternatives: {e}")
            active_server = None
            active_driver = None

    # 2. Probe candidate servers and drivers
    for s in CANDIDATE_SERVERS:
        for d in DRIVERS:
            try:
                cs = (
                    f"DRIVER={d};"
                    f"SERVER={s};"
                    f"DATABASE={DATABASE_NAME};"
                    f"Trusted_Connection=yes;"
                    f"TrustServerCertificate=yes;"
                    f"Connection Timeout={timeout};"
                )
                conn = pyodbc.connect(cs, timeout=timeout)
                active_server = s
                active_driver = d
                db_offline = False
                logger.info(f"Connected to SQL Server [{s}] with driver [{d}] on database [{DATABASE_NAME}]")
                return conn
            except Exception:
                continue

    db_offline = True
    return None


# Primary connection string format specifically required:
# "DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost\WINCC;DATABASE=MES_Milk_Production;Trusted_Connection=yes;TrustServerCertificate=yes;"
WINCC_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost\\WINCC;"
    "DATABASE=MES_Milk_Production;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=2;"
)


def verify_mes_database_status() -> bool:
    """
    Returns True ONLY if:
    1. SQL Server is reachable.
    2. Database 'MES_Milk_Production' can be queried with 'SELECT 1'.
    """
    try:
        conn = get_connection(timeout=2)
        if not conn:
            return False
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        row = cursor.fetchone()
        conn.close()
        return bool(row and row[0] == 1)
    except Exception:
        return False


def check_db_status() -> Dict[str, Any]:
    """
    Health Check endpoint utility:
    Executes SELECT 1 test query.
    Returns: { "connected": true, "database": "MES_Milk_Production", "timestamp": "...", "latency_ms": ... }
    """
    t0 = time.perf_counter()
    try:
        conn = get_connection(timeout=2)
        if not conn:
            return {
                "connected": False,
                "status": "disconnected",
                "database": DATABASE_NAME,
                "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "latency_ms": 0,
                "error": f"Database [{DATABASE_NAME}] unreachable on candidate servers"
            }
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        row = cursor.fetchone()
        conn.close()
        latency = round((time.perf_counter() - t0) * 1000, 2)
        if row and row[0] == 1:
            return {
                "connected": True,
                "status": "connected",
                "database": DATABASE_NAME,
                "server": active_server or r"localhost\WINCC",
                "driver": active_driver or "{ODBC Driver 17 for SQL Server}",
                "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "latency_ms": latency
            }
        else:
            return {
                "connected": False,
                "status": "disconnected",
                "database": DATABASE_NAME,
                "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "latency_ms": latency,
                "error": "Query verification failed"
            }
    except Exception as e:
        latency = round((time.perf_counter() - t0) * 1000, 2)
        return {
            "connected": False,
            "status": "disconnected",
            "database": DATABASE_NAME,
            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "latency_ms": latency,
            "error": str(e)
        }


def execute_query(query: str, params: Optional[tuple] = None, timeout: int = 3) -> Any:
    """
    Executes a SQL query.
    Returns list of dicts for SELECT queries.
    Commits and returns True for INSERT, UPDATE, DELETE queries.
    """
    conn = get_connection(timeout=timeout)
    if not conn:
        raise ConnectionError("Microsoft SQL Server database is offline")
    try:
        cursor = conn.cursor()
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)

        stripped = query.strip().upper()
        if stripped.startswith("SELECT") or "OUTPUT" in stripped:
            if not cursor.description:
                conn.close()
                return []
            columns = [column[0] for column in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            conn.close()
            return results
        else:
            conn.commit()
            conn.close()
            return True
    except Exception as e:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        raise e


def execute_transaction(operations: List[Tuple[str, Optional[tuple]]], timeout: int = 5) -> bool:
    """
    Executes multiple SQL operations inside an atomic transaction.
    Rolls back immediately if any statement fails.
    """
    conn = get_connection(timeout=timeout)
    if not conn:
        raise ConnectionError("Microsoft SQL Server database is offline")
    try:
        cursor = conn.cursor()
        for q, p in operations:
            if p:
                cursor.execute(q, p)
            else:
                cursor.execute(q)
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        if conn:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        raise e


def log_user_action(user_name: str, user_role: str, action_name: str, detail: str) -> bool:
    """Writes an interaction into dbo.UserActionLog."""
    try:
        query = """
        INSERT INTO UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime)
        VALUES (?, ?, ?, ?, GETDATE())
        """
        return execute_query(query, (user_name, user_role, action_name, detail), timeout=2)
    except Exception as e:
        logger.warning(f"Failed to log user action: {e}")
        return False


def log_plc_datalog(order_code: str, tag_name: str, value: float, unit: Optional[str] = None) -> bool:
    """Writes a telemetry snapshot into dbo.PLC_Datalog."""
    try:
        tag_unit = unit or ""
        query = """
        INSERT INTO PLC_Datalog (OrderCode, TagName, Value, Unit, ReadTime)
        VALUES (?, ?, ?, ?, GETDATE())
        """
        return execute_query(query, (order_code, tag_name, float(value), tag_unit), timeout=2)
    except Exception as e:
        logger.debug(f"Failed to log PLC datalog: {e}")
        return False


def update_tank_stock(
    material_code: str,
    quantity: Optional[float] = None,
    current_stock: Optional[float] = None,
    tank_id: Optional[str] = None,
    mode: str = "add",
    material_name: Optional[str] = None,
    remark: str = "",
    user: str = "Warehouse_Officer"
) -> Dict[str, Any]:
    """
    Directly updates physical tank inventory in dbo.Material_Stock.
    Strictly executes parameterized UPDATE and calls conn.commit() immediately.
    """
    conn = get_connection(timeout=3)
    if not conn:
        raise ConnectionError("Microsoft SQL Server database is offline")
    
    conn.autocommit = False
    cursor = conn.cursor()
    try:
        mat = (material_code or "").strip().upper()
        tank = (tank_id or "").strip().upper()

        if mode == "set" or (current_stock is not None and quantity is None):
            target_stock = float(current_stock if current_stock is not None else quantity)
            cursor.execute("""
                UPDATE dbo.Material_Stock
                SET CurrentStock = ?,
                    Last_Update = GETDATE()
                WHERE UPPER(Material_Code) = ? OR UPPER(AssignedTank) = ?;
            """, (target_stock, mat, tank))
        else:
            add_qty = float(quantity if quantity is not None else 0.0)
            cursor.execute("""
                UPDATE dbo.Material_Stock
                SET CurrentStock = CurrentStock + ?,
                    Total_Quantity = Total_Quantity + ?,
                    Last_Update = GETDATE()
                WHERE UPPER(Material_Code) = ? OR UPPER(AssignedTank) = ?;
            """, (add_qty, add_qty, mat, tank))
            
            if add_qty > 0:
                m_name = material_name or mat
                cursor.execute("""
                    INSERT INTO dbo.Material_Input (Material_Code, Material_Name, Quantity, Input_Time, Remark)
                    VALUES (?, ?, ?, GETDATE(), ?);
                """, (mat, m_name, add_qty, remark))

        # Explicitly call conn.commit() immediately after execution to guarantee persistence to disk
        conn.commit()

        # Fetch updated record
        cursor.execute("""
            SELECT Material_Code, Material_Name, AssignedTank, CurrentStock, TankCapacity, Unit, MinSafetyThreshold, Last_Update
            FROM dbo.Material_Stock
            WHERE UPPER(Material_Code) = ? OR UPPER(AssignedTank) = ?;
        """, (mat, tank))
        row = cursor.fetchone()
        res = {}
        if row:
            res = {
                "material_code": row[0],
                "material_name": row[1],
                "assigned_tank": row[2],
                "current_stock": float(row[3] or 0.0),
                "tank_capacity": float(row[4] or 5.0),
                "unit": row[5] or "L",
                "min_threshold": float(row[6] or 0.5),
                "last_update": str(row[7] or "")
            }
        cursor.close()
        conn.close()
        return res
    except Exception as e:
        if conn:
            try:
                conn.rollback()
                conn.close()
            except Exception:
                pass
        raise e


