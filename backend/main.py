"""
Unified FastAPI RESTful Backend for MES Production System
Synchronized with Microsoft SQL Server: localhost\\WINCC -> MES_Milk_Production
Supports direct execution and mounting within the Kepware Gateway.
"""

import sys
import os
import asyncio
import logging
import pyodbc
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from contextlib import contextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure backend directory is in path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from . import db_sync_engine, historian
    from .store_forward_engine import db_engine
    from .ai_copilot import ai_router
except (ImportError, ValueError):
    import db_sync_engine
    import historian
    from store_forward_engine import db_engine
    import ai_copilot
    ai_router = ai_copilot.ai_router

logger = logging.getLogger("MES_MainAPI")
logging.basicConfig(level=logging.INFO)

# Primary connection string for physical SQL Server instance
SQL_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost\\WINCC;"
    "DATABASE=MES_Milk_Production;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=3;"
)

@contextmanager
def get_fresh_db_connection(timeout: int = 3):
    """
    Acquires a fresh, isolated pyodbc connection to SQL Server.
    Guarantees that transactions are committed on success or rolled back on error,
    and physical connection socket is explicitly closed upon exit to prevent stale connections.
    """
    conn = None
    try:
        conn = pyodbc.connect(SQL_CONN_STR, timeout=timeout)
    except Exception as e:
        for alt in [r".\WINCC", "localhost", r"localhost\SQLEXPRESS", "."]:
            try:
                alt_cs = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={alt};DATABASE=MES_Milk_Production;Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout={timeout};"
                conn = pyodbc.connect(alt_cs, timeout=timeout)
                break
            except Exception:
                continue
        if not conn:
            raise ConnectionError(f"Cannot establish fresh connection to SQL Server: {e}")

    try:
        with conn:
            yield conn
    finally:
        try:
            conn.close()
        except Exception:
            pass

api_router = APIRouter()
api_router.include_router(ai_router, prefix="/api/ai", tags=["AI Copilot"])

# ============================================================================
# PYDANTIC SCHEMAS
# ============================================================================

class CustomerCreatePayload(BaseModel):
    code: Optional[str] = None
    CustomerCode: Optional[str] = None
    name: Optional[str] = None
    CustomerName: Optional[str] = None
    email: Optional[str] = ""
    ContactEmail: Optional[str] = ""
    phone: Optional[str] = ""
    PhoneNumber: Optional[str] = ""
    priority: Optional[int] = 2
    OrderPriority: Optional[int] = 2
    address: Optional[str] = ""
    FacilityAddress: Optional[str] = ""
    status: Optional[str] = "Active"
    is_active: Optional[bool] = True
    IsActive: Optional[bool] = True

class CustomerUpdatePayload(BaseModel):
    code: Optional[str] = None
    CustomerCode: Optional[str] = None
    name: Optional[str] = None
    CustomerName: Optional[str] = None
    email: Optional[str] = None
    ContactEmail: Optional[str] = None
    phone: Optional[str] = None
    PhoneNumber: Optional[str] = None
    priority: Optional[int] = None
    OrderPriority: Optional[int] = None
    address: Optional[str] = None
    FacilityAddress: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    IsActive: Optional[bool] = None

class RecipeCreatePayload(BaseModel):
    code: Optional[str] = None
    recipe_code: Optional[str] = None
    name: Optional[str] = None
    recipe_name: Optional[str] = None
    version: Optional[str] = "v1.0"
    status: Optional[str] = "RELEASED"
    category: Optional[str] = None
    author: Optional[str] = None
    temp_hot: Optional[float] = None
    tempHot: Optional[float] = None
    temp_cold: Optional[float] = None
    tempCold: Optional[float] = None
    ingredients: Optional[List[Dict[str, Any]]] = None
    parameters: Optional[List[Dict[str, Any]]] = None
    user: Optional[str] = "Process_Engineer"

class RecipeUpdatePayload(BaseModel):
    code: Optional[str] = None
    recipe_code: Optional[str] = None
    name: Optional[str] = None
    recipe_name: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    category: Optional[str] = None
    author: Optional[str] = None
    temp_hot: Optional[float] = None
    tempHot: Optional[float] = None
    temp_cold: Optional[float] = None
    tempCold: Optional[float] = None
    ingredients: Optional[List[Dict[str, Any]]] = None
    parameters: Optional[List[Dict[str, Any]]] = None
    user: Optional[str] = "Process_Engineer"

class OrderCreatePayload(BaseModel):
    order_code: Optional[str] = None
    orderId: Optional[str] = None
    id: Optional[str] = None
    recipe_id: Optional[int] = 1
    recipeId: Optional[int] = 1
    customer_id: Optional[int] = 1
    customerId: Optional[int] = 1
    target_volume: Optional[float] = 1000.0
    volume: Optional[float] = 1000.0
    status: Optional[str] = "Ready"
    user: Optional[str] = "Operator"

class OrderStatusUpdatePayload(BaseModel):
    status: str
    user: Optional[str] = "Operator"

class InventoryConsumePayload(BaseModel):
    order_code: Optional[str] = None
    order_id: Optional[str] = None
    orderId: Optional[str] = None
    consumed_items: Optional[List[Dict[str, Any]]] = None
    milk_qty: Optional[float] = None
    sugar_qty: Optional[float] = None
    additive_qty: Optional[float] = None
    user: Optional[str] = "SCADA_Sync"

class InventoryRestockPayload(BaseModel):
    material_code: str
    material_name: Optional[str] = None
    quantity: float
    lot_number: Optional[str] = None
    remark: Optional[str] = ""
    user: Optional[str] = "Warehouse_Officer"

class BatchCompletionPayload(BaseModel):
    order_code: Optional[str] = None
    orderId: Optional[str] = None
    report_code: Optional[str] = None
    recipe_applied: Optional[str] = "Fresh Pasteurized UHT Milk"
    recipeName: Optional[str] = None
    total_produced: Optional[float] = 1000.0
    volume: Optional[float] = None
    avg_deviation_percent: Optional[float] = 0.35
    avgDeviation: Optional[float] = 0.35
    quality_status: Optional[str] = "CONFORMING"
    disposition_action: Optional[str] = "RELEASED"
    sign_off_by: Optional[str] = "Lead QA Specialist"
    quality_results: Optional[List[Dict[str, Any]]] = None

class AuditLogPayload(BaseModel):
    username: Optional[str] = None
    user: Optional[str] = "Operator"
    role: Optional[str] = "Operator"
    action: Optional[str] = "OPERATION"
    action_name: Optional[str] = None
    detail: Optional[str] = ""

class TestDbPayload(BaseModel):
    server_name: Optional[str] = None
    serverName: Optional[str] = None
    database_name: Optional[str] = None
    databaseName: Optional[str] = None

class MaintenanceRecordPayload(BaseModel):
    equipment_id: Optional[int] = None
    equipmentId: Optional[Any] = None
    maintenance_type: Optional[str] = None
    maintenanceType: Optional[str] = None
    serviceAction: Optional[str] = None
    description: Optional[str] = None
    remarks: Optional[str] = None
    technician: Optional[str] = "Maintenance Technician"
    cost_vnd: Optional[float] = 0.0
    costVnd: Optional[float] = 0.0
    reset_runtime: Optional[bool] = True
    resetRuntime: Optional[bool] = True

class EquipmentStatusPayload(BaseModel):
    status: str
    duration_seconds: Optional[int] = 0
    durationSeconds: Optional[int] = 0
    trigger_source: Optional[str] = "OPERATOR_PANEL"
    triggerSource: Optional[str] = None


# ============================================================================
# 1. HEALTH CHECK & DATABASE HANDSHAKE
# ============================================================================

@api_router.get("/api/db/status")
@api_router.get("/api/sql/status")
async def get_db_status():
    """
    Heartbeat and health check endpoint for Header / Navbar SQL badge.
    Returns Store-and-Forward buffer status and SQL connection state.
    """
    def _compute_status():
        base_status = db_sync_engine.check_db_status()
        sql_connected = bool(base_status.get("connected", False))
        db_engine.is_sql_online = sql_connected
        pending_count = db_engine.get_pending_buffer_count()

        mode = "ONLINE" if (sql_connected and pending_count == 0) else ("SYNCING" if sql_connected else "BUFFERING")

        base_status.update({
            "sql_connected": sql_connected,
            "mode": mode,
            "buffered_count": pending_count,
            "connected": sql_connected,
            "status": "connected" if sql_connected else "disconnected",
        })
        return base_status

    return await asyncio.to_thread(_compute_status)


@api_router.post("/api/db/test")
@api_router.post("/api/sql/test")
async def test_db_handshake(payload: Optional[TestDbPayload] = None):
    """
    Tests SQL Server connection handshake to the requested host and database.
    """
    status = await asyncio.to_thread(db_sync_engine.check_db_status)
    target_server = (payload and (payload.server_name or payload.serverName)) or status.get("server") or r"localhost\WINCC"
    target_db = (payload and (payload.database_name or payload.databaseName)) or status.get("database") or "MES_Milk_Production"

    if status.get("connected"):
        return {
            "connected": True,
            "ok": True,
            "status": "connected",
            "server": target_server,
            "database": target_db,
            "version": "SQL SERVER 2022",
            "latency_ms": status.get("latency_ms", 15),
            "timestamp": status.get("timestamp"),
            "message": f"Successfully connected to {target_server} (SQL SERVER 2022)"
        }
    else:
        return {
            "connected": False,
            "ok": False,
            "status": "disconnected",
            "server": target_server,
            "database": target_db,
            "error": status.get("error", f"Could not establish handshake to {target_server}")
        }


# ============================================================================
# 2. CUSTOMERS API (Fresh Connection per Request, Safe Upsert & Status 400 Errors)
# ============================================================================

@api_router.get("/api/customers")
@api_router.get("/api/master/customers")
async def get_customers():
    """
    Reads all customers from dbo.Customers using a fresh pyodbc connection.
    Returns both SQL PascalCase and frontend camelCase field aliases.
    """
    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT CustomerID, CustomerCode, CustomerName, ContactEmail, PhoneNumber,
                           OrderPriority, FacilityAddress, IsActive
                    FROM Customers
                    ORDER BY CustomerID ASC
                """)
                rows = cur.fetchall()
                data = []
                for r in rows:
                    cid = r[0]
                    code = r[1] or f"CUS-{cid}"
                    name = r[2] or "Customer"
                    email = r[3] or ""
                    phone = r[4] or ""
                    priority = r[5] or 2
                    address = r[6] or ""
                    is_active = bool(r[7]) if r[7] is not None else True
                    status_str = "Active" if is_active else "Inactive"

                    data.append({
                        "CustomerID": cid,
                        "CustomerCode": code,
                        "CustomerName": name,
                        "ContactEmail": email,
                        "PhoneNumber": phone,
                        "OrderPriority": priority,
                        "FacilityAddress": address,
                        "IsActive": is_active,
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
                return data

    try:
        data = await asyncio.to_thread(_execute)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.post("/api/customers")
async def create_or_upsert_customer(payload: CustomerCreatePayload):
    """
    Inserts customer into dbo.Customers, or updates if CustomerCode already exists.
    Uses a fresh pyodbc connection within a with context manager.
    Returns specific error details with status code 400 on error.
    """
    code = (payload.code or payload.CustomerCode or "").strip().upper()
    name = (payload.name or payload.CustomerName or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="Customer Code is required")
    if not name:
        raise HTTPException(status_code=400, detail="Customer Name is required")

    email = (payload.email or payload.ContactEmail or "").strip()
    phone = (payload.phone or payload.PhoneNumber or "").strip()
    priority = int(payload.priority or payload.OrderPriority or 2)
    address = (payload.address or payload.FacilityAddress or "").strip()
    is_active = 1 if (str(payload.status or "").upper() != "INACTIVE" and getattr(payload, 'is_active', True) is not False) else 0

    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                # Check if CustomerCode already exists in database
                cur.execute("SELECT CustomerID FROM Customers WHERE CustomerCode = ?", (code,))
                existing = cur.fetchone()

                if existing:
                    cust_id = existing[0]
                    cur.execute("""
                        UPDATE Customers
                        SET CustomerName = ?, ContactEmail = ?, PhoneNumber = ?, OrderPriority = ?, FacilityAddress = ?, IsActive = ?
                        WHERE CustomerID = ?
                    """, (name, email, phone, priority, address, is_active, cust_id))
                    action = "updated"
                else:
                    cur.execute("""
                        INSERT INTO Customers (CustomerCode, CustomerName, ContactEmail, PhoneNumber, OrderPriority, FacilityAddress, IsActive)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (code, name, email, phone, priority, address, is_active))
                    cur.execute("SELECT @@IDENTITY")
                    id_row = cur.fetchone()
                    cust_id = int(id_row[0]) if id_row and id_row[0] else None
                    action = "created"

                return {
                    "CustomerID": cust_id,
                    "CustomerCode": code,
                    "CustomerName": name,
                    "ContactEmail": email,
                    "PhoneNumber": phone,
                    "OrderPriority": priority,
                    "FacilityAddress": address,
                    "IsActive": bool(is_active),
                    "action": action,
                    "id": cust_id,
                    "code": code,
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "priority": priority,
                    "address": address,
                    "status": "Active" if is_active else "Inactive"
                }

    try:
        res = await asyncio.to_thread(_execute)
        return {
            "status": "success",
            "message": f"Customer [{code}] {res['action']} successfully",
            "data": res
        }
    except pyodbc.IntegrityError as ie:
        err_msg = str(ie)
        if "2627" in err_msg or "2601" in err_msg or "UQ" in err_msg.upper():
            raise HTTPException(status_code=400, detail="Duplicate customer code")
        raise HTTPException(status_code=400, detail=f"Database integrity error: {err_msg}")
    except ConnectionError as ce:
        logger.error(f"DB Connection error creating customer: {ce}")
        raise HTTPException(status_code=400, detail=f"Database Connection Failed: {str(ce)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating/upserting customer: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.put("/api/customers/{customer_id}")
async def update_customer(customer_id: int, payload: CustomerUpdatePayload):
    """
    Updates an existing customer by CustomerID in dbo.Customers.
    Uses a fresh pyodbc connection within a with context manager.
    Checks for duplicate customer code and returns specific error details with status code 400.
    """
    code = (payload.code or payload.CustomerCode or "").strip().upper() or None
    name = (payload.name or payload.CustomerName or "").strip() or None
    email = payload.email if payload.email is not None else payload.ContactEmail
    phone = payload.phone if payload.phone is not None else payload.PhoneNumber
    priority = payload.priority if payload.priority is not None else payload.OrderPriority
    address = payload.address if payload.address is not None else payload.FacilityAddress

    is_active = None
    if payload.status is not None:
        is_active = 1 if payload.status.strip().upper() != "INACTIVE" else 0
    elif payload.is_active is not None:
        is_active = 1 if payload.is_active else 0
    elif payload.IsActive is not None:
        is_active = 1 if payload.IsActive else 0

    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                # 1. Verify customer exists
                cur.execute("SELECT CustomerID, CustomerCode, CustomerName, ContactEmail, PhoneNumber, OrderPriority, FacilityAddress, IsActive FROM Customers WHERE CustomerID = ?", (customer_id,))
                current = cur.fetchone()
                if not current:
                    raise HTTPException(status_code=404, detail=f"Customer ID {customer_id} not found")

                curr_cid, curr_code, curr_name, curr_email, curr_phone, curr_priority, curr_address, curr_active = current
                target_code = code if code is not None else curr_code
                target_name = name if name is not None else curr_name
                target_email = email if email is not None else (curr_email or "")
                target_phone = phone if phone is not None else (curr_phone or "")
                target_priority = priority if priority is not None else (curr_priority or 2)
                target_address = address if address is not None else (curr_address or "")
                target_active = is_active if is_active is not None else (1 if curr_active else 0)

                # 2. Check for duplicate code conflict on a different customer
                if target_code != curr_code:
                    cur.execute("SELECT CustomerID FROM Customers WHERE CustomerCode = ? AND CustomerID <> ?", (target_code, customer_id))
                    conflict = cur.fetchone()
                    if conflict:
                        raise HTTPException(status_code=400, detail="Duplicate customer code")

                # 3. Perform update
                cur.execute("""
                    UPDATE Customers
                    SET CustomerCode = ?,
                        CustomerName = ?,
                        ContactEmail = ?,
                        PhoneNumber = ?,
                        OrderPriority = ?,
                        FacilityAddress = ?,
                        IsActive = ?
                    WHERE CustomerID = ?
                """, (target_code, target_name, target_email, target_phone, target_priority, target_address, target_active, customer_id))

                return {
                    "CustomerID": customer_id,
                    "CustomerCode": target_code,
                    "CustomerName": target_name,
                    "ContactEmail": target_email,
                    "PhoneNumber": target_phone,
                    "OrderPriority": target_priority,
                    "FacilityAddress": target_address,
                    "IsActive": bool(target_active),
                    "id": customer_id,
                    "code": target_code,
                    "name": target_name,
                    "email": target_email,
                    "phone": target_phone,
                    "priority": target_priority,
                    "address": target_address,
                    "status": "Active" if target_active else "Inactive"
                }

    try:
        res = await asyncio.to_thread(_execute)
        return {
            "status": "success",
            "message": f"Customer [{res['CustomerCode']}] updated successfully",
            "data": res
        }
    except pyodbc.IntegrityError as ie:
        err_msg = str(ie)
        if "2627" in err_msg or "2601" in err_msg or "UQ" in err_msg.upper():
            raise HTTPException(status_code=400, detail="Duplicate customer code")
        raise HTTPException(status_code=400, detail=f"Database integrity error: {err_msg}")
    except ConnectionError as ce:
        logger.error(f"DB Connection error updating customer: {ce}")
        raise HTTPException(status_code=400, detail=f"Database Connection Failed: {str(ce)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating customer: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: int):
    """
    Removes customer by CustomerID from dbo.Customers.
    Uses a fresh pyodbc connection within a with context manager.
    """
    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT CustomerID, CustomerCode FROM Customers WHERE CustomerID = ?", (customer_id,))
                cust = cur.fetchone()
                if not cust:
                    raise HTTPException(status_code=404, detail=f"Customer ID {customer_id} not found")
                code = cust[1]
                cur.execute("DELETE FROM Customers WHERE CustomerID = ?", (customer_id,))
                return code

    try:
        code = await asyncio.to_thread(_execute)
        return {"status": "success", "message": f"Customer [{code}] deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting customer: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 3. RECIPES API
# ============================================================================

def _parse_recipe_item(item: Dict[str, Any], default_phase: str = "PH_DOSING") -> Tuple[str, str, str, float, float]:
    phase_id = str(item.get("phaseId") or item.get("phase_id") or default_phase)
    mat_code = str(item.get("material_code") or item.get("material_id") or item.get("materialId") or item.get("tagName") or item.get("id") or "RAW_MILK")
    mat_name = str(item.get("material_name") or item.get("materialName") or item.get("parameterName") or item.get("name") or mat_code)
    
    raw_pct = item.get("percentage") if item.get("percentage") is not None else item.get("targetValue", 0.0)
    try:
        pct = float(raw_pct)
    except (ValueError, TypeError):
        pct = 0.0

    raw_tol = item.get("tolerance") if item.get("tolerance") is not None else item.get("tolerancePercent", 1.0)
    try:
        if isinstance(raw_tol, str):
            clean_tol = raw_tol.replace("±", "").replace("%", "").replace("°C", "").strip()
            tol = float(clean_tol) if clean_tol else 1.0
        else:
            tol = float(raw_tol)
    except (ValueError, TypeError):
        tol = 1.0
    return (phase_id, mat_code, mat_name, pct, tol)


@api_router.get("/api/recipes")
@api_router.get("/api/master/recipes")
async def get_recipes():
    """Queries dbo.Recipes joined with dbo.Recipe_Detail."""
    try:
        data = await asyncio.to_thread(db_sync_engine.get_recipes)
        return {"status": "success", "success": True, "data": data}
    except Exception as e:
        logger.error(f"Error fetching recipes: {e}")
        return {"status": "error", "success": False, "message": str(e), "data": []}


@api_router.post("/api/recipes")
async def create_recipe(payload: RecipeCreatePayload):
    """
    Inserts Master Recipe with child ingredient proportions into Microsoft SQL Server.
    Uses an isolated fresh connection with explicit commit and rollback.
    """
    code = (payload.code or payload.recipe_code or f"RCP-{int(datetime.now().timestamp())}").strip().upper()
    name = payload.name or payload.recipe_name or "New Master Recipe"
    version = payload.version or "v1.0"
    status = payload.status or "RELEASED"
    t_hot = payload.temp_hot if payload.temp_hot is not None else (payload.tempHot or 138.0)
    t_cold = payload.temp_cold if payload.temp_cold is not None else (payload.tempCold or 4.0)
    user = payload.user or "Process_Engineer"
    items_to_insert = payload.parameters if payload.parameters is not None else (payload.ingredients or [])

    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                # 1. Insert into Recipes
                cur.execute("""
                    INSERT INTO Recipes (Recipe_Code, Recipe_Name, Version, Status, SterilizationTemp, CoolingTemp, CreatedDate)
                    VALUES (?, ?, ?, ?, ?, ?, GETDATE());
                """, (code, name, version, status, float(t_hot), float(t_cold)))

                # 2. Retrieve new Recipe_ID
                cur.execute("SELECT TOP 1 Recipe_ID FROM Recipes WHERE Recipe_Code = ? ORDER BY Recipe_ID DESC", (code,))
                row = cur.fetchone()
                new_id = int(row[0]) if row else 1

                # 3. Insert Recipe_Detail rows
                for item in items_to_insert:
                    ph, mc, mn, pct, tol = _parse_recipe_item(item)
                    cur.execute("""
                        INSERT INTO Recipe_Detail (Recipe_ID, PhaseID, Material_Code, Material_Name, Percentage, TolerancePercent)
                        VALUES (?, ?, ?, ?, ?, ?);
                    """, (new_id, ph, mc, mn, pct, tol))

                # 4. Audit Log
                cur.execute("""
                    INSERT INTO UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime)
                    VALUES (?, 'Process Engineer', 'RECIPE_CREATE', ?, GETDATE());
                """, (user, f"Created Master Recipe [{code}] {name} ({version})"))

                conn.commit()

                return {
                    "Recipe_ID": new_id,
                    "id": new_id,
                    "Recipe_Code": code,
                    "code": code,
                    "Recipe_Name": name,
                    "name": name,
                    "Version": version,
                    "version": version,
                    "Status": status,
                    "status": status,
                    "SterilizationTemp": t_hot,
                    "tempHot": t_hot,
                    "CoolingTemp": t_cold,
                    "tempCold": t_cold,
                }

    try:
        res = await asyncio.to_thread(_execute)
        return {
            "success": True,
            "status": "success",
            "message": f"Recipe [{code}] created successfully",
            "data": res
        }
    except pyodbc.IntegrityError as ie:
        logger.error(f"Recipe integrity error: {ie}")
        raise HTTPException(status_code=400, detail=f"Database integrity error: {str(ie)}")
    except ConnectionError as ce:
        logger.error(f"DB connection error: {ce}")
        raise HTTPException(status_code=400, detail=f"Database Connection Failed: {str(ce)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating recipe: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.patch("/api/recipes/{recipe_id}")
@api_router.put("/api/recipes/{recipe_id}")
async def update_recipe(recipe_id: int, payload: RecipeUpdatePayload):
    """
    Updates recipe parameters or status in dbo.Recipes and dbo.Recipe_Detail.
    Uses an isolated fresh connection with explicit commit and rollback.
    """
    user = payload.user or "Process_Engineer"
    items_to_update = payload.parameters if payload.parameters is not None else payload.ingredients

    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                # 1. Verify existence
                cur.execute("SELECT Recipe_ID, Recipe_Code, Recipe_Name, Version, Status, SterilizationTemp, CoolingTemp FROM Recipes WHERE Recipe_ID = ?", (recipe_id,))
                curr = cur.fetchone()
                if not curr:
                    raise HTTPException(status_code=404, detail=f"Recipe ID {recipe_id} not found")

                curr_id, curr_code, curr_name, curr_ver, curr_status, curr_thot, curr_tcold = curr

                target_code = payload.code.strip().upper() if payload.code else (payload.recipe_code.strip().upper() if payload.recipe_code else curr_code)
                target_name = payload.name if payload.name is not None else (payload.recipe_name if payload.recipe_name is not None else curr_name)
                target_ver = payload.version if payload.version is not None else curr_ver
                target_status = payload.status if payload.status is not None else curr_status
                target_thot = payload.temp_hot if payload.temp_hot is not None else (payload.tempHot if payload.tempHot is not None else curr_thot)
                target_tcold = payload.temp_cold if payload.temp_cold is not None else (payload.tempCold if payload.tempCold is not None else curr_tcold)

                # 2. Update Recipes table
                cur.execute("""
                    UPDATE Recipes
                    SET Recipe_Code = ?,
                        Recipe_Name = ?,
                        Version = ?,
                        Status = ?,
                        SterilizationTemp = ?,
                        CoolingTemp = ?
                    WHERE Recipe_ID = ?;
                """, (target_code, target_name, target_ver, target_status, float(target_thot), float(target_tcold), recipe_id))

                # 3. If parameters/ingredients supplied, refresh child Recipe_Detail rows
                if items_to_update is not None and len(items_to_update) > 0:
                    cur.execute("DELETE FROM Recipe_Detail WHERE Recipe_ID = ?", (recipe_id,))
                    for item in items_to_update:
                        ph, mc, mn, pct, tol = _parse_recipe_item(item)
                        cur.execute("""
                            INSERT INTO Recipe_Detail (Recipe_ID, PhaseID, Material_Code, Material_Name, Percentage, TolerancePercent)
                            VALUES (?, ?, ?, ?, ?, ?);
                        """, (recipe_id, ph, mc, mn, pct, tol))

                # 4. Audit Log
                cur.execute("""
                    INSERT INTO UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime)
                    VALUES (?, 'Process Engineer', 'RECIPE_UPDATE', ?, GETDATE());
                """, (user, f"Updated Recipe ID [{recipe_id}] [{target_code}] status={target_status}"))

                conn.commit()

                return {
                    "Recipe_ID": recipe_id,
                    "id": recipe_id,
                    "Recipe_Code": target_code,
                    "code": target_code,
                    "Recipe_Name": target_name,
                    "name": target_name,
                    "Version": target_ver,
                    "version": target_ver,
                    "Status": target_status,
                    "status": target_status,
                    "SterilizationTemp": target_thot,
                    "tempHot": target_thot,
                    "CoolingTemp": target_tcold,
                    "tempCold": target_tcold,
                }

    try:
        res = await asyncio.to_thread(_execute)
        return {
            "success": True,
            "status": "success",
            "message": f"Recipe {recipe_id} updated successfully",
            "data": res
        }
    except pyodbc.IntegrityError as ie:
        raise HTTPException(status_code=400, detail=f"Database integrity error: {str(ie)}")
    except ConnectionError as ce:
        raise HTTPException(status_code=400, detail=f"Database Connection Failed: {str(ce)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating recipe: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.delete("/api/recipes/{recipe_id}")
async def delete_recipe(recipe_id: int):
    """
    Deletes recipe from dbo.Recipes and child details from dbo.Recipe_Detail.
    Prevents deletion if referenced by existing production orders.
    """
    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                # 1. Verify existence
                cur.execute("SELECT Recipe_ID, Recipe_Code FROM Recipes WHERE Recipe_ID = ?", (recipe_id,))
                rcp = cur.fetchone()
                if not rcp:
                    raise HTTPException(status_code=404, detail=f"Recipe ID {recipe_id} not found")
                code = rcp[1]

                # 2. Check foreign key reference in Orders
                cur.execute("SELECT COUNT(*) FROM Orders WHERE Recipe_ID = ?", (recipe_id,))
                cnt = cur.fetchone()[0]
                if cnt > 0:
                    raise HTTPException(status_code=400, detail=f"Cannot delete recipe [{code}] because it is referenced by {cnt} active production order(s)")

                # 3. Delete details then header
                cur.execute("DELETE FROM Recipe_Detail WHERE Recipe_ID = ?", (recipe_id,))
                cur.execute("DELETE FROM Recipes WHERE Recipe_ID = ?", (recipe_id,))

                # 4. Audit Log
                cur.execute("""
                    INSERT INTO UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime)
                    VALUES ('Admin', 'Process Engineer', 'RECIPE_DELETE', ?, GETDATE());
                """, (f"Deleted Recipe ID [{recipe_id}] ({code})",))

                conn.commit()
                return code

    try:
        code = await asyncio.to_thread(_execute)
        return {"success": True, "status": "success", "message": f"Recipe [{code}] deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting recipe: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 4. ORDERS & DISPATCHING API
# ============================================================================

@api_router.get("/api/orders/search")
async def search_orders(
    keyword: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = 100
):
    """
    Historical Multi-Criteria Search & Filtering for Work Orders.
    Parameters:
      - keyword: Matches OrderCode or Order_ID
      - from_date: ISO format YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
      - to_date: ISO format YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
      - status: Completed, Running, Ready, All
      - limit: Max rows to return (default 100, max 500)
    """
    try:
        data = await asyncio.to_thread(
            db_sync_engine.search_orders,
            keyword=keyword,
            from_date=from_date,
            to_date=to_date,
            status=status,
            limit=limit or 100
        )
        return {
            "status": "success",
            "success": True,
            "count": len(data),
            "data": data
        }
    except Exception as e:
        logger.error(f"Error in search_orders endpoint: {e}")
        return {
            "status": "partial_offline",
            "success": False,
            "count": 0,
            "message": str(e),
            "data": []
        }


@api_router.get("/api/orders")
async def get_orders():
    """Fetches all active and past production orders from dbo.Orders."""
    try:
        data = await asyncio.to_thread(db_sync_engine.get_orders)
        return {"status": "success", "success": True, "data": data}
    except Exception as e:
        logger.error(f"Error fetching orders: {e}")
        return {"status": "error", "success": False, "message": str(e), "data": []}


@api_router.post("/api/orders")
async def create_order(payload: OrderCreatePayload):
    """
    Creates new production order with TargetVolume and target Recipe in dbo.Orders.
    Uses an isolated fresh connection with explicit commit and rollback.
    """
    order_code = (payload.order_code or payload.orderId or payload.id or f"WO-{datetime.now().strftime('%Y%m%d%H%M')}").strip().upper()
    raw_recipe_id = payload.recipe_id or payload.recipeId or 1
    raw_customer_id = payload.customer_id or payload.customerId or 1
    target_volume = float(payload.target_volume if payload.target_volume is not None else (payload.volume or 1000.0))
    status = (payload.status or "READY").strip().title()
    user = payload.user or "Operator"

    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                # 1. Resolve Recipe ID
                cur.execute("SELECT Recipe_ID FROM Recipes WHERE Recipe_ID = ?", (raw_recipe_id,))
                rcp_row = cur.fetchone()
                if not rcp_row:
                    cur.execute("SELECT TOP 1 Recipe_ID FROM Recipes ORDER BY Recipe_ID ASC")
                    first_rcp = cur.fetchone()
                    resolved_recipe_id = first_rcp[0] if first_rcp else 1
                else:
                    resolved_recipe_id = raw_recipe_id

                # 2. Resolve Customer ID
                cur.execute("SELECT CustomerID FROM Customers WHERE CustomerID = ?", (raw_customer_id,))
                cust_row = cur.fetchone()
                if not cust_row:
                    cur.execute("SELECT TOP 1 CustomerID FROM Customers ORDER BY CustomerID ASC")
                    first_cust = cur.fetchone()
                    resolved_customer_id = first_cust[0] if first_cust else 1
                else:
                    resolved_customer_id = raw_customer_id

                # 3. Check for existing order with same code
                cur.execute("SELECT Order_ID FROM Orders WHERE OrderCode = ?", (order_code,))
                existing = cur.fetchone()
                if existing:
                    oid = existing[0]
                    cur.execute("""
                        UPDATE Orders
                        SET Recipe_ID = ?, CustomerID = ?, TargetVolume = ?, Status = ?
                        WHERE Order_ID = ?;
                    """, (resolved_recipe_id, resolved_customer_id, target_volume, status, oid))
                else:
                    cur.execute("""
                        INSERT INTO Orders (OrderCode, Recipe_ID, CustomerID, TargetVolume, Status, ScheduledStartTime)
                        VALUES (?, ?, ?, ?, ?, GETDATE());
                    """, (order_code, resolved_recipe_id, resolved_customer_id, target_volume, status))
                    cur.execute("SELECT TOP 1 Order_ID FROM Orders WHERE OrderCode = ? ORDER BY Order_ID DESC", (order_code,))
                    oid_row = cur.fetchone()
                    oid = oid_row[0] if oid_row else 1

                # 4. Audit Log
                cur.execute("""
                    INSERT INTO UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime)
                    VALUES (?, 'Operator', 'ORDER_CREATE', ?, GETDATE());
                """, (user, f"Created Production Order [{order_code}] (Target: {target_volume}L)"))

                conn.commit()

                return {
                    "Order_ID": oid,
                    "id": order_code,
                    "OrderCode": order_code,
                    "orderId": order_code,
                    "recipeId": resolved_recipe_id,
                    "customerId": resolved_customer_id,
                    "targetVolume": target_volume,
                    "volume": target_volume,
                    "status": status
                }

    try:
        res = await asyncio.to_thread(_execute)
        return {
            "success": True,
            "status": "success",
            "message": f"Order [{order_code}] created successfully",
            "data": res
        }
    except pyodbc.IntegrityError as ie:
        raise HTTPException(status_code=400, detail=f"Database integrity error: {str(ie)}")
    except ConnectionError as ce:
        raise HTTPException(status_code=400, detail=f"Database Connection Failed: {str(ce)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating order: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.patch("/api/orders/{order_code}/status")
@api_router.put("/api/orders/{order_code}/status")
async def patch_order_status(order_code: str, payload: OrderStatusUpdatePayload):
    """Updates batch order status (Ready, Running, Held, Completed) in dbo.Orders."""
    user = payload.user or "Operator"
    status_norm = payload.status.strip().title()

    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                if status_norm == "Running":
                    cur.execute("""
                        UPDATE Orders
                        SET Status = ?, ActualStartTime = ISNULL(ActualStartTime, GETDATE())
                        WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?;
                    """, (status_norm, str(order_code), str(order_code)))
                elif status_norm == "Completed":
                    cur.execute("""
                        UPDATE Orders
                        SET Status = ?, ActualEndTime = ISNULL(ActualEndTime, GETDATE()), ActualVolume = ISNULL(ActualVolume, TargetVolume)
                        WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?;
                    """, (status_norm, str(order_code), str(order_code)))
                else:
                    cur.execute("""
                        UPDATE Orders
                        SET Status = ?
                        WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?;
                    """, (status_norm, str(order_code), str(order_code)))

                # Audit Log
                cur.execute("""
                    INSERT INTO UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime)
                    VALUES (?, 'Operator', 'BATCH_STATUS_UPDATE', ?, GETDATE());
                """, (user, f"Order [{order_code}] transitioned to {status_norm}"))

                conn.commit()
                return status_norm

    try:
        await asyncio.to_thread(_execute)
        return {"success": True, "status": "success", "message": f"Order {order_code} status transitioned to {status_norm}"}
    except Exception as e:
        logger.error(f"Error updating order status: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.delete("/api/orders/{order_code}")
async def delete_order(order_code: str):
    """Deletes order from dbo.Orders."""
    def _execute():
        with get_fresh_db_connection(timeout=3) as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM Orders WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?", (str(order_code), str(order_code)))
                cur.execute("""
                    INSERT INTO UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime)
                    VALUES ('Operator', 'Operator', 'ORDER_DELETE', ?, GETDATE());
                """, (f"Deleted Order [{order_code}]",))
                conn.commit()
                return order_code

    try:
        await asyncio.to_thread(_execute)
        return {"success": True, "status": "success", "message": f"Order [{order_code}] deleted successfully"}
    except Exception as e:
        logger.error(f"Error deleting order: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# 5. INVENTORY & TANK TELEMETRY API
# ============================================================================

@api_router.get("/api/inventory")
@api_router.get("/api/materials")
@api_router.get("/api/inventory/stock")
async def get_inventory():
    """Reads live levels for TANK-01 (RAW_MILK), TANK-02 (SUGAR), TANK-03 (ADDITIVE) from dbo.Material_Stock."""
    try:
        data = await asyncio.to_thread(db_sync_engine.get_inventory)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching inventory: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.post("/api/inventory/consume")
@api_router.post("/api/materials/consume")
async def consume_inventory(payload: InventoryConsumePayload):
    """Calculates and deducts material weights upon batch completion via atomic transaction."""
    try:
        order_code = payload.order_code or payload.order_id or payload.orderId or "UNKNOWN"
        items = payload.consumed_items or []

        if not items:
            if payload.milk_qty and payload.milk_qty > 0:
                items.append({"material_code": "RAW_MILK", "amount": payload.milk_qty})
            if payload.sugar_qty and payload.sugar_qty > 0:
                items.append({"material_code": "SUGAR", "amount": payload.sugar_qty})
            if payload.additive_qty and payload.additive_qty > 0:
                items.append({"material_code": "ADDITIVE", "amount": payload.additive_qty})

        user = payload.user or "SCADA_Sync"
        res = await asyncio.to_thread(db_sync_engine.consume_inventory, order_code, items, user)
        return {"status": "success", "message": f"Inventory deducted for order {order_code}", "data": res}
    except Exception as e:
        logger.error(f"Error consuming inventory: {e}")
        raise HTTPException(status_code=500, detail=f"Database Write Failed: {str(e)}")


@api_router.post("/api/inventory/restock")
async def restock_inventory(payload: InventoryRestockPayload):
    """Adds new material lots into dbo.Material_Input and updates dbo.Material_Stock."""
    try:
        mat_name = payload.material_name or payload.material_code
        remark = payload.remark or ""
        if payload.lot_number:
            remark = f"Lot {payload.lot_number}. {remark}".strip()
        user = payload.user or "Warehouse_Officer"

        res = await asyncio.to_thread(
            db_sync_engine.restock_inventory,
            payload.material_code, mat_name, payload.quantity, remark, user
        )
        return {"status": "success", "message": f"Restocked {payload.quantity} of {payload.material_code}", "data": res}
    except Exception as e:
        logger.error(f"Error restocking inventory: {e}")
        raise HTTPException(status_code=500, detail=f"Database Write Failed: {str(e)}")


# ============================================================================
# 6. PROCESS HISTORIAN & TELEMETRY API
# ============================================================================

@api_router.get("/api/telemetry/{order_code}")
@api_router.get("/api/historian/logs/{order_code}")
async def get_order_telemetry(order_code: str):
    """Returns time-series array logged into dbo.PLC_Datalog for real-time charting."""
    try:
        data = await asyncio.to_thread(db_sync_engine.get_telemetry, order_code)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching telemetry: {e}")
        return {"status": "error", "message": str(e), "data": []}


# ============================================================================
# 7. QUALITY ASSURANCE & BATCH REPORTS API
# ============================================================================

@api_router.post("/api/reports/batch-completion")
async def create_batch_completion_report(payload: BatchCompletionPayload):
    """
    Generates electronic batch record into dbo.ProductionReport
    and ingredient tolerance breakdown into dbo.Quality_Result.
    """
    try:
        order_code = payload.order_code or payload.orderId or "WO-UNKNOWN"
        report_code = payload.report_code or f"EBR-{int(datetime.now().timestamp())}"
        recipe = payload.recipe_applied or payload.recipeName or "Fresh Pasteurized UHT Milk"
        volume = payload.total_produced if payload.total_produced is not None else (payload.volume or 1000.0)
        avg_dev = payload.avg_deviation_percent if payload.avg_deviation_percent is not None else (payload.avgDeviation or 0.35)
        status = payload.quality_status or "CONFORMING"
        disposition = payload.disposition_action or "RELEASED"
        sign_off = payload.sign_off_by or "Lead QA Specialist"
        qr = payload.quality_results or []

        res = await asyncio.to_thread(
            db_sync_engine.create_batch_completion_report,
            order_code, report_code, recipe, volume, avg_dev, status, disposition, sign_off, qr
        )
        return {"status": "success", "message": f"Report [{report_code}] generated", "data": res}
    except Exception as e:
        logger.error(f"Error creating batch report: {e}")
        raise HTTPException(status_code=500, detail=f"Database Write Failed: {str(e)}")


@api_router.get("/api/reports")
@api_router.get("/api/reports/batch")
async def get_batch_reports():
    """Retrieves historical batch records with PASS/FAIL status from dbo.ProductionReport."""
    try:
        data = await asyncio.to_thread(db_sync_engine.get_batch_reports)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching batch reports: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.get("/api/reports/{order_code}")
@api_router.get("/api/reports/batch/{order_code}")
async def get_batch_report_detail(order_code: str):
    """Retrieves detailed production report and quality results for a specific batch."""
    try:
        data = await asyncio.to_thread(db_sync_engine.get_batch_report_detail, order_code)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching report detail: {e}")
        return {"status": "error", "message": str(e), "data": None}


# ============================================================================
# 8. AUDIT TRAIL API
# ============================================================================

@api_router.get("/api/audit")
@api_router.get("/api/audit/logs")
@api_router.get("/api/audit-logs")
async def get_audit_trail(limit: int = 100):
    """Retrieves audit trail entries from dbo.UserActionLog."""
    try:
        data = await asyncio.to_thread(db_sync_engine.get_audit_logs, limit)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching audit logs: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.post("/api/audit")
@api_router.post("/api/audit/log")
async def log_user_action(payload: AuditLogPayload):
    """Inserts user action or batch command pulse into dbo.UserActionLog."""
    try:
        user = payload.username or payload.user or "Operator"
        role = payload.role or "Operator"
        action = payload.action or payload.action_name or "OPERATION"
        detail = payload.detail or ""

        success = await asyncio.to_thread(db_sync_engine.audit_log, user, role, action, detail)
        return {"status": "success" if success else "failed"}
    except Exception as e:
        logger.error(f"Error logging user action: {e}")
        return {"status": "error", "message": str(e)}


# ============================================================================
# 9. EQUIPMENT ASSETS & MAINTENANCE MANAGEMENT API
# ============================================================================

@api_router.get("/api/equipment")
async def get_equipment_list():
    """Returns list of plant equipments from dbo.Equipment_Master with runtime metrics."""
    try:
        data = await asyncio.to_thread(historian.get_all_equipment)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching equipment: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.get("/api/equipment/maintenance")
async def get_equipment_maintenance_logs(equipment_id: Optional[int] = None):
    """Returns maintenance history from dbo.Equipment_Maintenance."""
    try:
        data = await asyncio.to_thread(historian.get_maintenance_history, equipment_id)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching maintenance history: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.post("/api/equipment/maintenance")
@api_router.post("/api/maintenance/record")
async def log_maintenance_record(payload: MaintenanceRecordPayload):
    """Logs a completed maintenance record and updates dbo.Equipment_Master count/runtime."""
    try:
        raw_id = payload.equipment_id if payload.equipment_id is not None else payload.equipmentId
        if raw_id is None:
            raise HTTPException(status_code=400, detail="equipment_id is required")

        # If passed as string like "EQ-01" or "PUMP_INLET", resolve to integer ID
        if isinstance(raw_id, str) and not raw_id.isdigit():
            eq = await asyncio.to_thread(historian.get_equipment_by_id_or_code, raw_id)
            if not eq:
                import re
                m = re.search(r'\d+', raw_id)
                eq_id = int(m.group(0)) if m else 1
            else:
                eq_id = int(eq["EquipmentID"])
        else:
            eq_id = int(raw_id)

        m_type = payload.maintenance_type or payload.maintenanceType or payload.serviceAction or "Preventive"
        desc = payload.description or payload.remarks or "Bảo dưỡng định kỳ hoàn tất."
        tech = payload.technician or "Kỹ thuật viên bảo trì"
        cost = float(payload.cost_vnd if payload.cost_vnd is not None else (payload.costVnd or 0.0))
        reset_rt = bool(payload.reset_runtime if payload.reset_runtime is not None else payload.resetRuntime)

        res = await asyncio.to_thread(
            historian.record_maintenance_event,
            eq_id, m_type, desc, tech, cost, reset_rt
        )
        return {"success": True, "status": "success", "message": f"Đã ghi nhận bảo trì cho thiết bị ID {eq_id}", "data": res}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error recording maintenance: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/api/equipment/{identifier}/status")
async def set_equipment_status(identifier: str, payload: EquipmentStatusPayload):
    """Updates equipment status in dbo.Equipment_Master and logs to dbo.Equipment_Status_History."""
    try:
        dur = payload.duration_seconds or payload.durationSeconds or 0
        src = payload.trigger_source or payload.triggerSource or "OPERATOR_PANEL"
        res = await asyncio.to_thread(
            historian.update_equipment_status,
            identifier, payload.status, dur, src
        )
        return {"status": "success", "data": res}
    except Exception as e:
        logger.error(f"Error updating equipment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/api/equipment/status-history")
@api_router.get("/api/equipment/transitions")
async def get_equipment_status_history(equipment_id: Optional[int] = None, limit: int = 100):
    """Retrieves state transition audit trail from dbo.Equipment_Status_History."""
    try:
        data = await asyncio.to_thread(historian.get_status_history, equipment_id, limit)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching status history: {e}")
        return {"status": "error", "message": str(e), "data": []}


@api_router.get("/api/setpoints/monitoring")
async def get_setpoint_monitoring():
    """Retrieves recent setpoint comparisons from dbo.PLC_Setpoint_Monitoring."""
    try:
        data = await asyncio.to_thread(historian.get_setpoint_monitoring_logs)
        return {"status": "success", "data": data}
    except Exception as e:
        logger.error(f"Error fetching setpoint monitoring: {e}")
        return {"status": "error", "message": str(e), "data": []}


# ============================================================================
# STANDALONE FASTAPI APP
# ============================================================================


app = FastAPI(title="MES SQL Server Synchronization Backend", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    print("[MES_Backend] Starting FastAPI SQL Server synchronization engine on http://127.0.0.1:8000")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
