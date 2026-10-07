"""
Unified Database Synchronization Engine for MES Production System
Connected to physical Microsoft SQL Server: localhost\\WINCC -> MES_Milk_Production
Authentication: Windows Integrated Security (Trusted_Connection=yes)
ODBC Driver: ODBC Driver 17 for SQL Server

Provides connection pooling, auto-reconnect, transaction rollbacks,
audit trail logging, and parameterized query helpers.
"""

import pyodbc
import time
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple

logger = logging.getLogger("DB_SyncEngine")
logging.basicConfig(level=logging.INFO)

# Primary physical connection string
CONN_STR_WINCC = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost\\WINCC;"
    "DATABASE=MES_Milk_Production;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=3;"
)

# Fallback server connection strings if needed
CANDIDATE_STRINGS = [
    CONN_STR_WINCC,
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=.\\WINCC;DATABASE=MES_Milk_Production;Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=3;",
    "DRIVER={ODBC Driver 18 for SQL Server};SERVER=localhost\\WINCC;DATABASE=MES_Milk_Production;Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=3;",
    "DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost;DATABASE=MES_Milk_Production;Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=3;",
]

active_conn_str: Optional[str] = None
circuit_breaker_offline: bool = False
last_probe_time: float = 0.0
CIRCUIT_RETRY_INTERVAL: float = 4.0  # seconds between probes when offline


def get_db_connection(timeout: int = 3) -> Optional[pyodbc.Connection]:
    """
    Acquires an active connection to Microsoft SQL Server MES_Milk_Production.
    Re-uses verified connection string, and automatically recovers on failure.
    """
    global active_conn_str, circuit_breaker_offline, last_probe_time

    now = time.time()
    if circuit_breaker_offline and (now - last_probe_time < CIRCUIT_RETRY_INTERVAL):
        return None

    last_probe_time = now

    # 1. Try cached working connection string
    if active_conn_str:
        try:
            conn = pyodbc.connect(active_conn_str, timeout=timeout)
            circuit_breaker_offline = False
            return conn
        except Exception as e:
            logger.debug(f"Cached connection string failed, probing alternatives: {e}")
            active_conn_str = None

    # 2. Probe candidate connection strings
    for cs in CANDIDATE_STRINGS:
        try:
            conn = pyodbc.connect(cs, timeout=timeout)
            active_conn_str = cs
            circuit_breaker_offline = False
            logger.info("Successfully connected to SQL Server MES_Milk_Production")
            return conn
        except Exception:
            continue

    circuit_breaker_offline = True
    return None


def execute_query(sql: str, params: Optional[tuple] = None, timeout: int = 3) -> List[Dict[str, Any]]:
    """
    Executes a parameterized SQL query with automatic cursor closing and dictionary mapping.
    Supports SELECT, INSERT, UPDATE, DELETE.
    """
    conn = get_db_connection(timeout=timeout)
    if not conn:
        raise ConnectionError("Cannot connect to SQL Server localhost\\WINCC - Service offline or unreachable")

    cursor = None
    try:
        cursor = conn.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)

        if cursor.description:
            columns = [column[0] for column in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            conn.commit()
            return results
        else:
            conn.commit()
            return [{"affected_rows": cursor.rowcount}]
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        logger.error(f"SQL Execution Error: {e} | Query: {sql}")
        raise e
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def execute_transaction(operations: List[Tuple[str, tuple]], timeout: int = 5) -> bool:
    """
    Executes multiple parameterized SQL operations in a single atomic ACID transaction.
    Automatically rolls back all operations if any statement fails.
    """
    conn = get_db_connection(timeout=timeout)
    if not conn:
        raise ConnectionError("Cannot connect to SQL Server localhost\\WINCC - Transaction aborted")

    cursor = None
    try:
        cursor = conn.cursor()
        for sql, params in operations:
            if params:
                cursor.execute(sql, params)
            else:
                cursor.execute(sql)
        conn.commit()
        return True
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        logger.error(f"Transaction Rolled Back due to error: {e}")
        raise e
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def audit_log(username: str, role: str, action: str, detail: str) -> bool:
    """
    Centralized audit logger writing to dbo.UserActionLog.
    """
    sql = """
    INSERT INTO UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime)
    VALUES (?, ?, ?, ?, GETDATE());
    """
    try:
        execute_query(sql, (username or "Operator", role or "Staff", action, detail or ""))
        return True
    except Exception as e:
        logger.warning(f"Failed to record audit trail: {e}")
        return False


def check_db_status() -> Dict[str, Any]:
    """
    Real-time status check for Header SQL badge and Configuration view.
    """
    t0 = time.time()
    try:
        conn = get_db_connection(timeout=2)
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            conn.close()
            latency = max(1, int((time.time() - t0) * 1000))
            return {
                "connected": True,
                "status": "connected",
                "database": "MES_Milk_Production",
                "server": r"localhost\WINCC",
                "latency_ms": latency,
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        logger.debug(f"DB Ping failed: {e}")

    return {
        "connected": False,
        "status": "disconnected",
        "database": "MES_Milk_Production",
        "server": r"localhost\WINCC",
        "latency_ms": 0,
        "timestamp": datetime.now().isoformat(),
        "error": "SQL Server service offline or port blocked"
    }


# ============================================================================
# 1. CUSTOMERS REPOSITORY
# ============================================================================

def get_customers() -> List[Dict[str, Any]]:
    sql = """
    SELECT CustomerID, CustomerCode, CustomerName, ContactEmail, PhoneNumber,
           OrderPriority, FacilityAddress, IsActive
    FROM Customers
    ORDER BY CustomerID ASC;
    """
    rows = execute_query(sql)
    customers = []
    for r in rows:
        cid = r.get("CustomerID")
        code = r.get("CustomerCode") or f"CUS-{cid}"
        name = r.get("CustomerName") or "Customer"
        email = r.get("ContactEmail") or ""
        phone = r.get("PhoneNumber") or ""
        priority = int(r.get("OrderPriority") or 2)
        address = r.get("FacilityAddress") or ""
        is_active = bool(r.get("IsActive", True))
        status_str = "Active" if is_active else "Inactive"

        customers.append({
            # Physical SQL columns
            "CustomerID": cid,
            "CustomerCode": code,
            "CustomerName": name,
            "ContactEmail": email,
            "PhoneNumber": phone,
            "OrderPriority": priority,
            "FacilityAddress": address,
            "IsActive": is_active,
            # Frontend compatibility aliases
            "id": cid,
            "code": code,
            "name": name,
            "email": email,
            "phone": phone,
            "priority": priority,
            "address": address,
            "status": status_str,
            "activeOrdersCount": 1 if is_active else 0
        })
    return customers


def create_customer(code: str, name: str, email: str = "", phone: str = "", priority: int = 2, address: str = "") -> Dict[str, Any]:
    # Check if customer code already exists
    existing = execute_query("SELECT CustomerID FROM Customers WHERE CustomerCode = ?", (code,))
    if existing:
        cid = existing[0]["CustomerID"]
        update_sql = """
        UPDATE Customers
        SET CustomerName = ?, ContactEmail = ?, PhoneNumber = ?, OrderPriority = ?, FacilityAddress = ?, IsActive = 1
        WHERE CustomerID = ?;
        """
        execute_query(update_sql, (name, email, phone, priority, address, cid))
        audit_log("Admin", "Supervisor", "CUSTOMER_UPDATE", f"Updated Customer [{code}] {name} (Priority {priority})")
        return {"CustomerID": cid, "CustomerCode": code, "CustomerName": name, "action": "updated"}

    sql = """
    INSERT INTO Customers (CustomerCode, CustomerName, ContactEmail, PhoneNumber, OrderPriority, FacilityAddress, IsActive)
    VALUES (?, ?, ?, ?, ?, ?, 1);
    """
    execute_query(sql, (code, name, email, phone, priority, address))

    # Retrieve inserted ID
    id_res = execute_query("SELECT TOP 1 CustomerID FROM Customers WHERE CustomerCode = ? ORDER BY CustomerID DESC", (code,))
    new_id = id_res[0]["CustomerID"] if id_res else None

    audit_log("Admin", "Supervisor", "CUSTOMER_CREATE", f"Created Customer [{code}] {name} (Priority {priority})")
    return {"CustomerID": new_id, "CustomerCode": code, "CustomerName": name, "action": "created"}


def update_customer(customer_id: int, code: Optional[str] = None, name: Optional[str] = None,
                    email: Optional[str] = None, phone: Optional[str] = None,
                    priority: Optional[int] = None, address: Optional[str] = None,
                    is_active: Optional[bool] = None) -> Dict[str, Any]:
    # Check if code conflicts with another customer
    if code:
        conflict = execute_query("SELECT CustomerID FROM Customers WHERE CustomerCode = ? AND CustomerID <> ?", (code, customer_id))
        if conflict:
            raise ValueError(f"Duplicate customer code: {code}")

    update_sql = """
    UPDATE Customers
    SET CustomerCode = ISNULL(?, CustomerCode),
        CustomerName = ISNULL(?, CustomerName),
        ContactEmail = ISNULL(?, ContactEmail),
        PhoneNumber = ISNULL(?, PhoneNumber),
        OrderPriority = ISNULL(?, OrderPriority),
        FacilityAddress = ISNULL(?, FacilityAddress),
        IsActive = ISNULL(?, IsActive)
    WHERE CustomerID = ?;
    """
    execute_query(update_sql, (code, name, email, phone, priority, address, is_active, customer_id))
    audit_log("Admin", "Supervisor", "CUSTOMER_UPDATE", f"Updated Customer ID [{customer_id}]")
    return {"CustomerID": customer_id, "status": "updated"}


def delete_customer(customer_id: int) -> bool:
    # First get customer details for audit
    cust = execute_query("SELECT CustomerCode, CustomerName FROM Customers WHERE CustomerID = ?", (customer_id,))
    code = cust[0]["CustomerCode"] if cust else f"#{customer_id}"

    sql = "DELETE FROM Customers WHERE CustomerID = ?;"
    execute_query(sql, (customer_id,))
    audit_log("Admin", "Supervisor", "CUSTOMER_DELETE", f"Removed Customer ID [{customer_id}] ({code}) from registry")
    return True


# ============================================================================
# 2. RECIPES REPOSITORY
# ============================================================================

def get_recipes() -> List[Dict[str, Any]]:
    recipes_sql = """
    SELECT Recipe_ID, Recipe_Code, Recipe_Name, Version, Status,
           SterilizationTemp, CoolingTemp, CreatedDate
    FROM Recipes
    ORDER BY Recipe_ID ASC;
    """
    recipes = execute_query(recipes_sql)

    details_sql = """
    SELECT Detail_ID, Recipe_ID, PhaseID, Material_Code, Material_Name,
           Percentage, TolerancePercent
    FROM Recipe_Detail
    ORDER BY Detail_ID ASC;
    """
    details = execute_query(details_sql)

    formatted = []
    for r in recipes:
        rid = r.get("Recipe_ID")
        rcode = r.get("Recipe_Code") or f"RCP-{rid}"
        rname = r.get("Recipe_Name") or "Recipe"
        ver = r.get("Version") or "v1.0"
        status = r.get("Status") or "RELEASED"
        t_hot = float(r.get("SterilizationTemp") or 138.0)
        t_cold = float(r.get("CoolingTemp") or 4.0)
        created = str(r.get("CreatedDate") or "")

        matching_details = [d for d in details if d.get("Recipe_ID") == rid]
        ingredients = []
        parameters = []
        for d in matching_details:
            mat_code = d.get("Material_Code")
            mat_name = d.get("Material_Name") or mat_code
            pct = float(d.get("Percentage") or 0.0)
            tol = float(d.get("TolerancePercent") or 1.0)
            phase_id = d.get("PhaseID") or "PH_DOSING"

            ingredients.append({
                "material_id": mat_code,
                "material_code": mat_code,
                "material_name": mat_name,
                "percentage": pct,
                "target_qty": round(pct * 10.0, 2),
                "tolerance": tol,
                "unit": "L" if "MILK" in mat_code or "ADD" in mat_code else "kg"
            })

            parameters.append({
                "id": f"p-{d.get('Detail_ID')}",
                "phaseId": phase_id,
                "parameterName": f"Dosing {mat_name}",
                "targetValue": pct,
                "unit": "%",
                "tolerance": f"±{tol}%"
            })

        formatted.append({
            "Recipe_ID": rid,
            "Recipe_Code": rcode,
            "Recipe_Name": rname,
            "Version": ver,
            "Status": status,
            "SterilizationTemp": t_hot,
            "CoolingTemp": t_cold,
            "CreatedDate": created,
            # Frontend aliases
            "id": rid,
            "code": rcode,
            "name": rname,
            "version": ver,
            "status": status,
            "tempHot": t_hot,
            "tempCold": t_cold,
            "targetVolume": 1000.0,
            "ingredients": ingredients,
            "parameters": parameters
        })
    return formatted


def create_recipe(code: str, name: str, version: str = "v1.0", status: str = "RELEASED",
                  temp_hot: float = 138.0, temp_cold: float = 4.0,
                  ingredients: Optional[List[Dict[str, Any]]] = None,
                  user: str = "Engineer") -> Dict[str, Any]:
    # 1. Insert Master Recipe
    insert_recipe_sql = """
    INSERT INTO Recipes (Recipe_Code, Recipe_Name, Version, Status, SterilizationTemp, CoolingTemp, CreatedDate)
    VALUES (?, ?, ?, ?, ?, ?, GETDATE());
    """
    execute_query(insert_recipe_sql, (code, name, version, status, temp_hot, temp_cold))

    # Retrieve new ID
    id_res = execute_query("SELECT TOP 1 Recipe_ID FROM Recipes WHERE Recipe_Code = ? ORDER BY Recipe_ID DESC", (code,))
    new_id = id_res[0]["Recipe_ID"] if id_res else 1

    # 2. Insert child ingredients if provided
    if ingredients:
        ops = []
        for ing in ingredients:
            mat_code = ing.get("material_id") or ing.get("material_code") or "RAW_MILK"
            mat_name = ing.get("material_name") or mat_code
            pct = float(ing.get("percentage") or 0.0)
            tol = float(ing.get("tolerance") or 1.0)
            phase = ing.get("phase_id") or ing.get("phaseId") or "PH_DOSING"

            insert_detail_sql = """
            INSERT INTO Recipe_Detail (Recipe_ID, PhaseID, Material_Code, Material_Name, Percentage, TolerancePercent)
            VALUES (?, ?, ?, ?, ?, ?)
            """
            ops.append((insert_detail_sql, (new_id, phase, mat_code, mat_name, pct, tol)))
        if ops:
            execute_transaction(ops)

    audit_log(user, "Process Engineer", "RECIPE_CREATE", f"Created Master Recipe [{code}] {name} ({version})")
    return {"Recipe_ID": new_id, "Recipe_Code": code, "Recipe_Name": name}


def update_recipe(recipe_id: int, status: Optional[str] = None, temp_hot: Optional[float] = None,
                  temp_cold: Optional[float] = None, user: str = "Engineer") -> bool:
    updates = []
    params = []
    if status is not None:
        updates.append("Status = ?")
        params.append(status)
    if temp_hot is not None:
        updates.append("SterilizationTemp = ?")
        params.append(temp_hot)
    if temp_cold is not None:
        updates.append("CoolingTemp = ?")
        params.append(temp_cold)

    if not updates:
        return True

    params.append(recipe_id)
    sql = f"UPDATE Recipes SET {', '.join(updates)} WHERE Recipe_ID = ?;"
    execute_query(sql, tuple(params))
    audit_log(user, "Process Engineer", "RECIPE_UPDATE", f"Updated Recipe ID [{recipe_id}] status={status}")
    return True


# ============================================================================
# 3. ORDERS REPOSITORY
# ============================================================================

def get_orders() -> List[Dict[str, Any]]:
    sql = """
    SELECT o.Order_ID, o.OrderCode, o.Recipe_ID, o.CustomerID, o.TargetVolume,
           o.ActualVolume, o.Status, o.ScheduledStartTime, o.ActualStartTime, o.ActualEndTime,
           r.Recipe_Name, r.Recipe_Code, r.Version as RecipeVersion,
           c.CustomerName, c.CustomerCode
    FROM Orders o
    LEFT JOIN Recipes r ON o.Recipe_ID = r.Recipe_ID
    LEFT JOIN Customers c ON o.CustomerID = c.CustomerID
    ORDER BY o.Order_ID DESC;
    """
    rows = execute_query(sql)
    formatted = []
    for r in rows:
        oid = r.get("Order_ID")
        code = r.get("OrderCode") or f"WO-{oid}"
        r_name = r.get("Recipe_Name") or "Fresh Pasteurized UHT Milk"
        c_name = r.get("CustomerName") or "Vinamilk Corporation"
        vol = float(r.get("TargetVolume") or 1000.0)
        act_vol = float(r.get("ActualVolume") or 0.0)
        status = (r.get("Status") or "Ready").upper()
        sched = str(r.get("ScheduledStartTime") or "")
        start = str(r.get("ActualStartTime") or "")
        end = str(r.get("ActualEndTime") or "")

        formatted.append({
            "Order_ID": oid,
            "OrderCode": code,
            "Recipe_ID": r.get("Recipe_ID"),
            "CustomerID": r.get("CustomerID"),
            "TargetVolume": vol,
            "ActualVolume": act_vol,
            "Status": status,
            "ScheduledStartTime": sched,
            "ActualStartTime": start,
            "ActualEndTime": end,
            "Recipe_Name": r_name,
            "CustomerName": c_name,
            # Frontend Operations queue fields
            "id": code,
            "orderId": code,
            "orderName": f"{code} ({r_name})",
            "recipeId": r.get("Recipe_ID") or 1,
            "recipeCode": r.get("Recipe_Code") or f"RCP-{r.get('Recipe_ID')}",
            "recipeName": r_name,
            "recipeVersion": r.get("RecipeVersion") or "v1.2",
            "customerId": r.get("CustomerID") or 1,
            "customerCode": r.get("CustomerCode") or f"CUS-{r.get('CustomerID')}",
            "customerName": c_name,
            "volume": vol,
            "quantity": vol,
            "status": status,
            "targetUnit": "UNIT MIXING",
            "scheduledStartTime": sched,
            "startTime": start if start else "---",
            "endTime": end if end else "---",
            "targetScadaNode": "SCADA_Line_01",
            "assignedCell": "Process Cell 1 (Physical S7-1500)",
            "elapsedTime": "00:00:00"
        })
    return formatted


def search_orders(
    keyword: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Historical order search and multi-criteria filtering.
    Executes dbo.sp_Search_Orders when available, with fallback to parameterized raw SQL.
    """
    clean_kw = keyword.strip() if keyword and keyword.strip() else None
    clean_st = status.strip() if status and status.strip() and status.strip().upper() != "ALL" else None
    clamped_limit = max(1, min(int(limit or 100), 500))

    dt_from = None
    if from_date and str(from_date).strip():
        f_s = str(from_date).strip()
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                dt_from = datetime.strptime(f_s, fmt)
                break
            except ValueError:
                continue

    dt_to = None
    if to_date and str(to_date).strip():
        t_s = str(to_date).strip()
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                dt_to = datetime.strptime(t_s, fmt)
                if fmt == "%Y-%m-%d":
                    dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=997000)
                break
            except ValueError:
                continue

    rows = []
    cols = []
    conn = get_db_connection(timeout=3)
    if not conn:
        logger.warning("Database offline during search_orders, returning empty fallback list")
        return []

    try:
        # Attempt 1: Execute Stored Procedure dbo.sp_Search_Orders
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "EXEC dbo.sp_Search_Orders @SearchKeyword=?, @FromDate=?, @ToDate=?, @Status=?, @MaxRows=?",
                    (clean_kw, dt_from, dt_to, clean_st, clamped_limit)
                )
                cols = [c[0] for c in cur.description]
                rows = cur.fetchall()
        except Exception as sp_err:
            logger.warning(f"Stored Procedure dbo.sp_Search_Orders execution fallback ({sp_err})")
            # Attempt 2: Parameterized raw SQL fallback
            sql = """
            SELECT TOP (?) o.Order_ID, o.OrderCode, o.Recipe_ID, o.CustomerID,
                           r.Recipe_Name, c.CustomerName, o.TargetVolume,
                           ISNULL(o.ActualVolume, 0) AS ActualVolume,
                           o.Status, o.ScheduledStartTime, o.ActualStartTime, o.ActualEndTime,
                           DATEDIFF(MINUTE, o.ActualStartTime, o.ActualEndTime) AS DurationMinutes,
                           r.Recipe_Code, r.Version as RecipeVersion, c.CustomerCode
            FROM dbo.Orders o
            LEFT JOIN dbo.Recipes r ON o.Recipe_ID = r.Recipe_ID
            LEFT JOIN dbo.Customers c ON o.CustomerID = c.CustomerID
            WHERE (? IS NULL OR o.OrderCode LIKE '%' + ? + '%' OR CAST(o.Order_ID AS NVARCHAR(20)) = ?)
              AND (? IS NULL OR ISNULL(o.ActualStartTime, o.ScheduledStartTime) >= ?)
              AND (? IS NULL OR ISNULL(o.ActualStartTime, o.ScheduledStartTime) <= ?)
              AND (? IS NULL OR UPPER(o.Status) = UPPER(?))
            ORDER BY ISNULL(o.ActualStartTime, o.ScheduledStartTime) DESC;
            """
            with conn.cursor() as cur:
                cur.execute(sql, (clamped_limit, clean_kw, clean_kw, clean_kw, dt_from, dt_from, dt_to, dt_to, clean_st, clean_st))
                cols = [c[0] for c in cur.description]
                rows = cur.fetchall()
    except Exception as query_err:
        logger.error(f"Error querying orders in search_orders: {query_err}")
        return []
    finally:
        try:
            conn.close()
        except Exception:
            pass

    formatted = []
    for row in rows:
        r = dict(zip(cols, row))
        oid = r.get("Order_ID")
        code = r.get("OrderCode") or f"WO-{oid}"
        r_name = r.get("Recipe_Name") or "Fresh Pasteurized UHT Milk"
        c_name = r.get("CustomerName") or "Vinamilk Corporation"
        vol = float(r.get("TargetVolume") or 1000.0)
        act_vol = float(r.get("ActualVolume") or 0.0)
        status_val = (r.get("Status") or "Ready").upper()
        
        sched = r.get("ScheduledStartTime")
        sched_str = sched.strftime("%Y-%m-%d %H:%M:%S") if isinstance(sched, datetime) else str(sched or "")
        
        start = r.get("ActualStartTime")
        start_str = start.strftime("%Y-%m-%d %H:%M:%S") if isinstance(start, datetime) else str(start or "")
        
        end = r.get("ActualEndTime")
        end_str = end.strftime("%Y-%m-%d %H:%M:%S") if isinstance(end, datetime) else str(end or "")
        
        duration = r.get("DurationMinutes")

        formatted.append({
            "Order_ID": oid,
            "OrderCode": code,
            "Recipe_ID": r.get("Recipe_ID") or 1,
            "CustomerID": r.get("CustomerID") or 1,
            "TargetVolume": vol,
            "ActualVolume": act_vol,
            "Status": status_val,
            "ScheduledStartTime": sched_str,
            "ActualStartTime": start_str,
            "ActualEndTime": end_str,
            "DurationMinutes": duration,
            "Recipe_Name": r_name,
            "CustomerName": c_name,
            # Frontend Operations queue fields
            "id": code,
            "orderId": code,
            "orderName": f"{code} ({r_name})",
            "recipeId": r.get("Recipe_ID") or 1,
            "recipeCode": r.get("Recipe_Code") or f"RCP-{r.get('Recipe_ID', 1)}",
            "recipeName": r_name,
            "recipeVersion": r.get("RecipeVersion") or "v1.2",
            "customerId": r.get("CustomerID") or 1,
            "customerCode": r.get("CustomerCode") or f"CUS-{r.get('CustomerID', 1)}",
            "customerName": c_name,
            "volume": vol,
            "quantity": vol,
            "actualVolume": act_vol,
            "status": status_val,
            "targetUnit": "UNIT MIXING",
            "scheduledStartTime": sched_str,
            "startTime": start_str if start_str else "---",
            "endTime": end_str if end_str else "---",
            "duration": f"{duration}m" if duration is not None else "---",
            "targetScadaNode": "SCADA_Line_01",
            "assignedCell": "Process Cell 1 (Physical S7-1500)",
            "elapsedTime": "00:00:00"
        })
    return formatted



def delete_recipe(recipe_id: int) -> bool:
    orders = execute_query("SELECT COUNT(*) as cnt FROM Orders WHERE Recipe_ID = ?", (recipe_id,))
    if orders and orders[0].get("cnt", 0) > 0:
        raise ValueError("Cannot delete recipe because it is referenced by existing production orders")
    ops = [
        ("DELETE FROM Recipe_Detail WHERE Recipe_ID = ?", (recipe_id,)),
        ("DELETE FROM Recipes WHERE Recipe_ID = ?", (recipe_id,))
    ]
    execute_transaction(ops)
    audit_log("Admin", "Process Engineer", "RECIPE_DELETE", f"Deleted Recipe ID [{recipe_id}]")
    return True


def create_order(order_code: str, recipe_id: int = 1, customer_id: int = 1,
                 target_volume: float = 1000.0, status: str = "Ready", user: str = "Operator") -> Dict[str, Any]:
    sql = """
    INSERT INTO Orders (OrderCode, Recipe_ID, CustomerID, TargetVolume, Status, ScheduledStartTime)
    VALUES (?, ?, ?, ?, ?, GETDATE());
    """
    execute_query(sql, (order_code, recipe_id, customer_id, target_volume, status))
    audit_log(user, "Operator", "ORDER_CREATE", f"Created Production Order [{order_code}] (Target: {target_volume}L)")
    return {"OrderCode": order_code, "Status": status, "TargetVolume": target_volume}


def update_order_status(order_code: str, status: str, user: str = "Operator") -> bool:
    status_norm = status.strip().title()  # e.g., 'Running', 'Completed', 'Held', 'Ready'

    if status_norm == "Running":
        sql = """
        UPDATE Orders
        SET Status = ?, ActualStartTime = ISNULL(ActualStartTime, GETDATE())
        WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?;
        """
    elif status_norm == "Completed":
        sql = """
        UPDATE Orders
        SET Status = ?, ActualEndTime = GETDATE(), ActualVolume = ISNULL(ActualVolume, TargetVolume)
        WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?;
        """
    else:
        sql = """
        UPDATE Orders
        SET Status = ?
        WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?;
        """

    execute_query(sql, (status_norm, str(order_code), str(order_code)))
    audit_log(user, "Operator", "BATCH_STATUS_UPDATE", f"Order [{order_code}] transitioned to {status_norm}")
    return True


def delete_order(order_code: str) -> bool:
    sql = "DELETE FROM Orders WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?;"
    execute_query(sql, (str(order_code), str(order_code)))
    audit_log("Admin", "Operator", "ORDER_DELETE", f"Deleted Production Order [{order_code}]")
    return True


# ============================================================================
# 4. INVENTORY & TANK TELEMETRY
# ============================================================================

def get_inventory() -> List[Dict[str, Any]]:
    sql = """
    SELECT Material_Code, Material_Name, AssignedTank, CurrentStock,
           Total_Quantity, Unit, TankCapacity, MinSafetyThreshold, Last_Update
    FROM Material_Stock
    ORDER BY Material_Code ASC;
    """
    rows = execute_query(sql)
    stocks = []
    for r in rows:
        mcode = r.get("Material_Code")
        mname = r.get("Material_Name") or mcode
        tank = r.get("AssignedTank") or "TANK-01"
        stock = float(r.get("CurrentStock") or 0.0)
        cap = float(r.get("TankCapacity") or 10000.0)
        unit = r.get("Unit") or "L"
        min_thresh = float(r.get("MinSafetyThreshold") or 1000.0)
        last_up = str(r.get("Last_Update") or "")
        status = "LOW_STOCK" if stock < min_thresh else "NORMAL"

        stocks.append({
            "Material_Code": mcode,
            "Material_Name": mname,
            "AssignedTank": tank,
            "CurrentStock": stock,
            "Total_Quantity": float(r.get("Total_Quantity") or cap),
            "Unit": unit,
            "TankCapacity": cap,
            "MinSafetyThreshold": min_thresh,
            "Last_Update": last_up,
            # Frontend aliases
            "materialCode": mcode,
            "materialName": mname,
            "tankId": tank,
            "tankName": f"Storage {tank}",
            "currentStock": stock,
            "capacity": cap,
            "unit": unit,
            "minThreshold": min_thresh,
            "lastUpdated": last_up,
            "status": status
        })
    return stocks


def consume_inventory(order_code: str, items: List[Dict[str, Any]], user: str = "SCADA_Sync") -> Dict[str, Any]:
    """
    Calculates and deducts material weights upon batch completion via atomic ACID transaction.
    """
    ops = []
    summary = []
    for item in items:
        mat_code = item.get("material_code") or item.get("materialCode")
        amount = float(item.get("amount") or item.get("consumedQty") or 0.0)
        if mat_code and amount > 0:
            sql = """
            UPDATE Material_Stock
            SET CurrentStock = CASE WHEN CurrentStock - ? < 0 THEN 0 ELSE CurrentStock - ? END,
                Last_Update = GETDATE()
            WHERE Material_Code = ?;
            """
            ops.append((sql, (amount, amount, mat_code)))
            summary.append(f"-{amount} of {mat_code}")

    if ops:
        execute_transaction(ops)

    detail = f"Batch [{order_code}] consumed: " + ", ".join(summary)
    audit_log(user, "System", "MATERIAL_CONSUME", detail)
    return {"order_code": order_code, "deductions": summary}


def restock_inventory(material_code: str, material_name: str, quantity: float,
                      remark: str = "", user: str = "Warehouse_Officer") -> Dict[str, Any]:
    """
    Records new inbound lot into dbo.Material_Input and increases dbo.Material_Stock in a single transaction.
    """
    insert_input_sql = """
    INSERT INTO Material_Input (Material_Code, Material_Name, Quantity, Input_Time, Remark)
    VALUES (?, ?, ?, GETDATE(), ?);
    """
    update_stock_sql = """
    UPDATE Material_Stock
    SET CurrentStock = CurrentStock + ?,
        Total_Quantity = Total_Quantity + ?,
        Last_Update = GETDATE()
    WHERE Material_Code = ?;
    """
    ops = [
        (insert_input_sql, (material_code, material_name, quantity, remark)),
        (update_stock_sql, (quantity, quantity, material_code))
    ]
    execute_transaction(ops)

    audit_log(user, "Logistics", "MATERIAL_RESTOCK", f"Inbound lot received: +{quantity} of [{material_code}] ({remark})")
    return {"material_code": material_code, "quantity_added": quantity, "remark": remark}


# ============================================================================
# 5. PROCESS HISTORIAN & TELEMETRY
# ============================================================================

def log_telemetry(order_code: str, tag_name: str, value: float) -> bool:
    sql = """
    INSERT INTO PLC_Datalog (OrderCode, TagName, Value, ReadTime)
    VALUES (?, ?, ?, GETDATE());
    """
    try:
        execute_query(sql, (order_code, tag_name, value))
        return True
    except Exception as e:
        logger.debug(f"Telemetry log error: {e}")
        return False


def get_telemetry(order_code: str) -> List[Dict[str, Any]]:
    try:
        from . import historian
    except (ImportError, ValueError):
        import historian
    return historian.get_telemetry_for_order(order_code)


# ============================================================================
# 6. QUALITY ASSURANCE & BATCH REPORTS
# ============================================================================

def create_batch_completion_report(order_code: str, report_code: str, recipe_applied: str,
                                   total_produced: float, avg_deviation: float,
                                   quality_status: str, disposition: str, sign_off: str,
                                   quality_results: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    # 1. Insert ProductionReport
    insert_report_sql = """
    INSERT INTO ProductionReport
    (ReportCode, OrderCode, RecipeApplied, TotalProduced, AvgDeviationPercent, QualityStatus, DispositionAction, SignOffBy, CreatedTime)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE());
    """
    execute_query(insert_report_sql, (report_code, order_code, recipe_applied, total_produced, avg_deviation, quality_status, disposition, sign_off))

    # 2. Insert Quality_Result entries if provided
    if quality_results:
        ops = []
        for qr in quality_results:
            param_name = qr.get("parameter_name") or qr.get("parameterName") or "Parameter"
            sp = float(qr.get("setpoint") or 0.0)
            act = float(qr.get("actual_value") or qr.get("actualValue") or sp)
            dev = float(qr.get("deviation_percent") or qr.get("deviation") or 0.0)
            tol = qr.get("tolerance_band") or qr.get("tolerance") or "±1%"
            eval_res = qr.get("evaluation") or "PASS"

            insert_qr_sql = """
            INSERT INTO Quality_Result
            (ReportCode, OrderCode, ParameterName, Setpoint, ActualValue, DeviationPercent, ToleranceBand, Evaluation, CheckedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE());
            """
            ops.append((insert_qr_sql, (report_code, order_code, param_name, sp, act, dev, tol, eval_res)))
        if ops:
            execute_transaction(ops)

    audit_log(sign_off, "QA Specialist", "BATCH_COMPLETION_REPORT", f"Generated EBR [{report_code}] for Order [{order_code}] - Disposition: {disposition}")
    return {"ReportCode": report_code, "OrderCode": order_code, "QualityStatus": quality_status}


def get_batch_reports() -> List[Dict[str, Any]]:
    sql = """
    SELECT Report_ID, ReportCode, OrderCode, RecipeApplied, TotalProduced,
           AvgDeviationPercent, QualityStatus, DispositionAction, SignOffBy, CreatedTime
    FROM ProductionReport
    ORDER BY CreatedTime DESC;
    """
    return execute_query(sql)


def get_batch_report_detail(order_code: str) -> Dict[str, Any]:
    report_sql = "SELECT * FROM ProductionReport WHERE OrderCode = ? OR ReportCode = ?;"
    reports = execute_query(report_sql, (order_code, order_code))

    qr_sql = "SELECT * FROM Quality_Result WHERE OrderCode = ? OR ReportCode = ? ORDER BY CheckedAt ASC;"
    q_results = execute_query(qr_sql, (order_code, order_code))

    return {
        "report": reports[0] if reports else None,
        "quality_results": q_results
    }


# ============================================================================
# 7. AUDIT TRAIL REPOSITORY
# ============================================================================

def get_audit_logs(limit: int = 100) -> List[Dict[str, Any]]:
    sql = f"""
    SELECT TOP {limit} ID, UserName, UserRole, ActionName, Detail, ActionTime
    FROM UserActionLog
    ORDER BY ActionTime DESC;
    """
    return execute_query(sql)
