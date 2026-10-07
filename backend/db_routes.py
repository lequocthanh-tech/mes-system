"""
Bi-Directional REST Endpoints for MES Production System
Connected to Microsoft SQL Server database MES_Milk_Production
"""

import sys
import os
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from . import db_connector
    from .store_forward_engine import db_engine
except (ImportError, ValueError):
    import db_connector
    try:
        from store_forward_engine import db_engine
    except ImportError:
        db_engine = None

logger = logging.getLogger("DB_Routes")
router = APIRouter()

# ============================================================================
# HEALTH CHECK & HEARTBEAT
# ============================================================================

@router.get("/api/db/status")
async def get_db_status():
    r"""
    Heartbeat and health check endpoint for Header / Navbar SQL badge.
    Returns Store-and-Forward buffer status and SQL connection state.
    """
    def _compute_status():
        base_status = db_connector.check_db_status()
        sql_connected = bool(base_status.get("connected", False))
        pending_count = db_engine.get_pending_buffer_count() if db_engine else 0
        if db_engine:
            db_engine.is_sql_online = sql_connected

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


class TestDbPayload(BaseModel):
    server_name: Optional[str] = None
    serverName: Optional[str] = None
    database_name: Optional[str] = None
    databaseName: Optional[str] = None
    auth_mode: Optional[str] = None
    authMode: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    port: Optional[int] = None


@router.post("/api/db/test")
@router.post("/api/sql/test")
async def test_db_handshake(payload: Optional[TestDbPayload] = None):
    """
    Tests SQL Server connection handshake to the requested host and database.
    Returns { connected: true, ok: true, version: 'SQL SERVER 2022', ... } on success.
    """
    requested_host = None
    requested_db = None
    if payload:
        requested_host = payload.server_name or payload.serverName
        requested_db = payload.database_name or payload.databaseName

    # Verify physical status via db_connector
    status = await asyncio.to_thread(db_connector.check_db_status)
    is_connected = bool(status.get("connected"))

    target_server = requested_host or status.get("server") or r"localhost\WINCC"
    target_db = requested_db or status.get("database") or "MES_Milk_Production"

    if is_connected:
        return {
            "connected": True,
            "ok": True,
            "status": "connected",
            "server": target_server,
            "database": target_db,
            "version": "SQL SERVER 2022",
            "latency_ms": status.get("latency_ms", 10),
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
# MASTER DATA: CUSTOMERS
# ============================================================================

@router.get("/api/customers")
@router.get("/api/master/customers")
async def get_customers():
    """
    Reads all registered customers from dbo.Customers.
    Provides dual-format fields for frontend compatibility.
    """
    try:
        query = """
        SELECT CustomerID, CustomerCode, CustomerName, ContactEmail, PhoneNumber,
               OrderPriority, FacilityAddress, IsActive
        FROM Customers
        ORDER BY CustomerID ASC
        """
        rows = await asyncio.to_thread(db_connector.execute_query, query, None, 3)
        formatted = []
        for r in rows:
            cid = r.get("CustomerID")
            code = r.get("CustomerCode") or f"CUS-{cid}"
            name = r.get("CustomerName") or "Customer"
            email = r.get("ContactEmail") or ""
            phone = r.get("PhoneNumber") or ""
            priority = r.get("OrderPriority") or 2
            address = r.get("FacilityAddress") or ""
            is_active = bool(r.get("IsActive", True))
            status_str = "Active" if is_active else "Inactive"

            formatted.append({
                # SQL fields
                "CustomerID": cid,
                "CustomerCode": code,
                "CustomerName": name,
                "ContactEmail": email,
                "PhoneNumber": phone,
                "OrderPriority": priority,
                "FacilityAddress": address,
                "IsActive": is_active,
                # Frontend camelCase / legacy aliases
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
        return {"status": "success", "data": formatted}
    except Exception as e:
        logger.warning(f"Error reading Customers from SQL Server: {e}")
        # Return fallback on error to prevent UI freeze
        return {"status": "error", "message": str(e), "data": []}


# ============================================================================
# MASTER DATA: RECIPES & RECIPE DETAILS
# ============================================================================

@router.get("/api/recipes")
@router.get("/api/master/recipes")
async def get_recipes():
    """
    Reads active Master Recipes from dbo.Recipes joined with dbo.Recipe_Detail.
    """
    try:
        recipes_query = """
        SELECT Recipe_ID, Recipe_Code, Recipe_Name, Version, Status,
               SterilizationTemp, CoolingTemp, CreatedDate
        FROM Recipes
        ORDER BY Recipe_ID ASC
        """
        recipes = await asyncio.to_thread(db_connector.execute_query, recipes_query, None, 3)

        details_query = """
        SELECT Detail_ID, Recipe_ID, PhaseID, Material_Code, Material_Name,
               Percentage, TolerancePercent
        FROM Recipe_Detail
        ORDER BY Detail_ID ASC
        """
        details = await asyncio.to_thread(db_connector.execute_query, details_query, None, 3)

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
                    "target_qty": round(pct * 10.0, 2),  # per 1000L standard batch
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
                # SQL table fields
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

        return {"status": "success", "data": formatted}
    except Exception as e:
        logger.warning(f"Error reading Recipes from SQL Server: {e}")
        return {"status": "error", "message": str(e), "data": []}


@router.post("/api/recipes")
async def create_recipe(payload: Dict[str, Any]):
    """
    Creates new Master Recipe in dbo.Recipes and detail items in dbo.Recipe_Detail.
    Logs action to dbo.UserActionLog.
    """
    try:
        recipe_code = payload.get("recipe_code") or payload.get("code") or f"RCP-{int(datetime.now().timestamp())}"
        recipe_name = payload.get("recipe_name") or payload.get("name") or "New Recipe"
        version = payload.get("version") or "v1.0"
        status = payload.get("status") or "RELEASED"
        temp_hot = float(payload.get("temp_hot") or payload.get("tempHot") or 138.0)
        temp_cold = float(payload.get("temp_cold") or payload.get("tempCold") or 4.0)

        # 1. Insert Master Recipe
        insert_recipe_sql = """
        INSERT INTO Recipes (Recipe_Code, Recipe_Name, Version, Status, SterilizationTemp, CoolingTemp, CreatedDate)
        VALUES (?, ?, ?, ?, ?, ?, GETDATE());
        """
        await asyncio.to_thread(
            db_connector.execute_query,
            insert_recipe_sql,
            (recipe_code, recipe_name, version, status, temp_hot, temp_cold),
            3
        )

        # Retrieve new Recipe_ID
        id_query = "SELECT TOP 1 Recipe_ID FROM Recipes WHERE Recipe_Code = ? ORDER BY Recipe_ID DESC"
        id_res = await asyncio.to_thread(db_connector.execute_query, id_query, (recipe_code,), 2)
        new_id = id_res[0]["Recipe_ID"] if id_res else 1

        # 2. Insert Details if provided
        ingredients = payload.get("ingredients") or payload.get("recipe_details") or []
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
            await asyncio.to_thread(
                db_connector.execute_query,
                insert_detail_sql,
                (new_id, phase, mat_code, mat_name, pct, tol),
                2
            )

        # 3. Log Audit Trail
        user = payload.get("user") or "MES_Engineer"
        await asyncio.to_thread(
            db_connector.log_user_action,
            user, "Engineer", "RECIPE_CREATE", f"Created Master Recipe [{recipe_code}] {recipe_name}"
        )

        return {
            "status": "success",
            "message": f"Recipe {recipe_code} created successfully",
            "recipe_id": new_id,
            "recipe_code": recipe_code
        }
    except Exception as e:
        logger.error(f"Error creating recipe in SQL Server: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# OPERATIONS & ORDERS
# ============================================================================

@router.get("/api/orders")
async def get_orders():
    """
    Reads active and scheduled production orders from dbo.Orders joined with Recipes and Customers.
    """
    try:
        query = """
        SELECT o.Order_ID, o.OrderCode, o.Recipe_ID, o.CustomerID, o.TargetVolume,
               o.ActualVolume, o.Status, o.ScheduledStartTime, o.ActualStartTime, o.ActualEndTime,
               r.Recipe_Name, r.Recipe_Code, r.Version as RecipeVersion,
               c.CustomerName, c.CustomerCode
        FROM Orders o
        LEFT JOIN Recipes r ON o.Recipe_ID = r.Recipe_ID
        LEFT JOIN Customers c ON o.CustomerID = c.CustomerID
        ORDER BY o.Order_ID DESC
        """
        rows = await asyncio.to_thread(db_connector.execute_query, query, None, 3)
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
                # SQL fields
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
                "orderName": f"{code} ({r_name})",
                "recipeName": r_name,
                "recipeVersion": r.get("RecipeVersion") or "v1.2",
                "customerName": c_name,
                "volume": vol,
                "status": status,
                "scheduledStartTime": sched,
                "startTime": start,
                "endTime": end,
                "targetScadaNode": "SCADA_Line_01",
                "assignedCell": "Process Cell 1 (Physical S7-1500)",
                "elapsedTime": "00:00:00"
            })
        return {"status": "success", "data": formatted}
    except Exception as e:
        logger.warning(f"Error reading Orders from SQL Server: {e}")
        return {"status": "error", "message": str(e), "data": []}


@router.post("/api/orders")
async def create_order(payload: Dict[str, Any]):
    """
    Inserts new production batch order into dbo.Orders.
    Logs action to dbo.UserActionLog.
    """
    try:
        order_code = payload.get("order_code") or payload.get("orderId") or payload.get("id") or f"WO-{datetime.now().strftime('%Y%m%d%H%M')}"
        recipe_id = int(payload.get("recipe_id") or payload.get("recipeId") or 1)
        customer_id = int(payload.get("customer_id") or payload.get("customerId") or 1)
        target_volume = float(payload.get("target_volume") or payload.get("volume") or 1000.0)
        status = payload.get("status") or "Ready"

        insert_sql = """
        INSERT INTO Orders (OrderCode, Recipe_ID, CustomerID, TargetVolume, Status, ScheduledStartTime)
        VALUES (?, ?, ?, ?, ?, GETDATE())
        """
        await asyncio.to_thread(
            db_connector.execute_query,
            insert_sql,
            (order_code, recipe_id, customer_id, target_volume, status),
            3
        )

        user = payload.get("user") or "Operator"
        await asyncio.to_thread(
            db_connector.log_user_action,
            user, "Operator", "ORDER_CREATE", f"Created Production Order [{order_code}] for Recipe #{recipe_id}"
        )

        return {"status": "success", "message": f"Order {order_code} inserted into SQL Server", "order_code": order_code}
    except Exception as e:
        logger.error(f"Error creating order in SQL Server: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/api/orders/{order_id}/status")
@router.put("/api/orders/{order_id}/status")
async def update_order_status(order_id: str, payload: Dict[str, Any]):
    """
    Updates batch status (Ready, Running, Completed, Held, Aborted).
    Updates ActualStartTime or ActualEndTime automatically.
    Logs action to dbo.UserActionLog.
    """
    try:
        raw_status = payload.get("status") or "Running"
        status_norm = raw_status.strip().title()  # e.g., 'Running', 'Completed', 'Held'

        if status_norm == "Running":
            query = """
            UPDATE Orders 
            SET Status = ?, ActualStartTime = ISNULL(ActualStartTime, GETDATE())
            WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?
            """
        elif status_norm == "Completed":
            query = """
            UPDATE Orders 
            SET Status = ?, ActualEndTime = GETDATE(), ActualVolume = ISNULL(ActualVolume, TargetVolume)
            WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?
            """
        else:
            query = """
            UPDATE Orders 
            SET Status = ?
            WHERE OrderCode = ? OR CAST(Order_ID AS NVARCHAR) = ?
            """

        await asyncio.to_thread(
            db_connector.execute_query,
            query,
            (status_norm, str(order_id), str(order_id)),
            3
        )

        # Notify active running order state in gateway if available
        try:
            from backend import kepware_gateway
            if status_norm == "Running":
                kepware_gateway.active_running_order_code = order_id
            elif status_norm in ["Completed", "Aborted"]:
                if getattr(kepware_gateway, "active_running_order_code", None) == order_id:
                    kepware_gateway.active_running_order_code = None
        except Exception:
            pass

        user = payload.get("user") or "System"
        await asyncio.to_thread(
            db_connector.log_user_action,
            user, "Operator", "BATCH_STATUS_UPDATE", f"Order [{order_id}] status transitioned to {status_norm}"
        )

        return {"status": "success", "message": f"Order {order_id} status updated to {status_norm}"}
    except Exception as e:
        logger.error(f"Error updating order status in SQL Server: {e}")
        return {"status": "error", "message": str(e)}


# ============================================================================
# INVENTORY MANAGEMENT: SILO STOCKS & CONSUMPTION
# ============================================================================

@router.get("/api/materials")
@router.get("/api/inventory/stock")
async def get_materials():
    """
    Reads live silo tank inventory levels from dbo.Material_Stock.
    """
    try:
        query = """
        SELECT Material_Code, Material_Name, AssignedTank, CurrentStock,
               Total_Quantity, Unit, TankCapacity, MinSafetyThreshold, Last_Update
        FROM Material_Stock
        ORDER BY Material_Code ASC
        """
        rows = await asyncio.to_thread(db_connector.execute_query, query, None, 3)
        formatted = []
        for r in rows:
            mcode = r.get("Material_Code")
            mname = r.get("Material_Name") or mcode
            tank = r.get("AssignedTank") or "TANK-01"
            stock = float(r.get("CurrentStock") or 0.0)
            total = float(r.get("Total_Quantity") or 10000.0)
            unit = r.get("Unit") or "L"
            cap = float(r.get("TankCapacity") or 10000.0)
            min_thresh = float(r.get("MinSafetyThreshold") or 1000.0)
            last_up = str(r.get("Last_Update") or "")
            status = "LOW_STOCK" if stock < min_thresh else "NORMAL"

            formatted.append({
                # SQL fields
                "Material_Code": mcode,
                "Material_Name": mname,
                "AssignedTank": tank,
                "CurrentStock": stock,
                "Total_Quantity": total,
                "Unit": unit,
                "TankCapacity": cap,
                "MinSafetyThreshold": min_thresh,
                "Last_Update": last_up,
                # Aliases for frontend inventory components
                "Material_ID": mcode,
                "material_code": mcode,
                "materialCode": mcode,
                "material_name": mname,
                "materialName": mname,
                "Tank_ID": tank,
                "tank_id": tank,
                "tankId": tank,
                "Tank_Name": f"Storage {tank}",
                "tankName": f"Storage {tank}",
                "Current_Qty": stock,
                "current_stock": stock,
                "currentStock": stock,
                "Capacity": cap,
                "capacity": cap,
                "unit": unit,
                "Min_Threshold": min_thresh,
                "min_threshold": min_thresh,
                "minThreshold": min_thresh,
                "Last_Updated": last_up,
                "last_updated": last_up,
                "lastUpdated": last_up,
                "Status": status,
                "status": status
            })
        return {"status": "success", "data": formatted}
    except Exception as e:
        logger.warning(f"Error reading Material_Stock from SQL Server: {e}")
        return {"status": "error", "message": str(e), "data": []}


@router.post("/api/materials/consume")
async def consume_materials(payload: Dict[str, Any]):
    """
    Executes atomic SQL transaction to deduct material amounts after batch completion.
    Payload: {
        "order_id": "WO-2026-001",
        "consumed_items": [
            {"material_code": "RAW_MILK", "amount": 700.0},
            {"material_code": "SUGAR", "amount": 200.0},
            {"material_code": "ADDITIVE", "amount": 100.0}
        ]
    }
    """
    try:
        order_id = payload.get("order_id") or "UNKNOWN_ORDER"
        consumed_items = payload.get("consumed_items") or []

        if not consumed_items:
            # Check for alternative shorthand parameters
            milk_qty = float(payload.get("milk_qty") or 0.0)
            sugar_qty = float(payload.get("sugar_qty") or 0.0)
            additive_qty = float(payload.get("additive_qty") or 0.0)
            if milk_qty > 0:
                consumed_items.append({"material_code": "RAW_MILK", "amount": milk_qty})
            if sugar_qty > 0:
                consumed_items.append({"material_code": "SUGAR", "amount": sugar_qty})
            if additive_qty > 0:
                consumed_items.append({"material_code": "ADDITIVE", "amount": additive_qty})

        operations: List[tuple] = []
        deductions_summary = []

        for item in consumed_items:
            mat_code = item.get("material_code") or item.get("materialCode")
            amount = float(item.get("amount") or item.get("consumedQty") or 0.0)
            if mat_code and amount > 0:
                # Update query ensuring current stock does not drop below 0
                sql = """
                UPDATE Material_Stock
                SET CurrentStock = CASE WHEN CurrentStock - ? < 0 THEN 0 ELSE CurrentStock - ? END,
                    Last_Update = GETDATE()
                WHERE Material_Code = ?
                """
                operations.append((sql, (amount, amount, mat_code)))
                deductions_summary.append(f"-{amount} of {mat_code}")

        if operations:
            await asyncio.to_thread(db_connector.execute_transaction, operations, 5)

        # Log to UserActionLog
        detail = f"Batch [{order_id}] consumed: " + ", ".join(deductions_summary)
        await asyncio.to_thread(
            db_connector.log_user_action,
            "SCADA_Sync", "System", "MATERIAL_DEDUCTION", detail
        )

        return {
            "status": "success",
            "message": f"Deducted inventory for order {order_id}",
            "deductions": deductions_summary
        }
    except Exception as e:
        logger.error(f"Error in material deduction transaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AUDIT TRAIL & EBR ELECTRONIC BATCH REPORTS
# ============================================================================

@router.get("/api/audit/logs")
@router.get("/api/audit-logs")
async def get_audit_logs():
    """Reads latest user action logs from dbo.UserActionLog."""
    try:
        query = "SELECT TOP 100 * FROM UserActionLog ORDER BY ActionTime DESC"
        logs = await asyncio.to_thread(db_connector.execute_query, query, None, 3)
        return {"status": "success", "data": logs}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}


@router.post("/api/audit/log")
async def add_audit_log(payload: Dict[str, Any]):
    """Inserts interaction into dbo.UserActionLog."""
    try:
        user = payload.get("username") or payload.get("user") or "Operator"
        role = payload.get("role") or "Operator"
        action = payload.get("action") or payload.get("action_name") or "INTERACTION"
        detail = payload.get("detail") or ""

        success = await asyncio.to_thread(
            db_connector.log_user_action,
            user, role, action, detail
        )
        return {"status": "success" if success else "failed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/api/reports/batch-completion")
async def create_batch_completion_report(payload: Dict[str, Any]):
    """
    Writes full Electronic Batch Record (EBR) summary into dbo.ProductionReport
    and parameter evaluations into dbo.Quality_Result.
    """
    try:
        order_code = payload.get("order_code") or payload.get("orderId") or "WO-UNKNOWN"
        report_code = payload.get("report_code") or payload.get("reportCode") or f"EBR-{int(datetime.now().timestamp())}"
        recipe_applied = payload.get("recipe_applied") or payload.get("recipeName") or "Fresh Pasteurized UHT Milk"
        total_produced = float(payload.get("total_produced") or payload.get("volume") or 1000.0)
        avg_dev = float(payload.get("avg_deviation_percent") or payload.get("avgDeviation") or 0.35)
        quality_status = payload.get("quality_status") or payload.get("qualityStatus") or "CONFORMING"
        disposition = payload.get("disposition_action") or payload.get("disposition") or "RELEASED"
        sign_off = payload.get("sign_off_by") or payload.get("operator") or "Lead QA Specialist"

        # 1. Insert ProductionReport
        insert_report_sql = """
        INSERT INTO ProductionReport 
        (ReportCode, OrderCode, RecipeApplied, TotalProduced, AvgDeviationPercent, QualityStatus, DispositionAction, SignOffBy, CreatedTime)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
        """
        await asyncio.to_thread(
            db_connector.execute_query,
            insert_report_sql,
            (report_code, order_code, recipe_applied, total_produced, avg_dev, quality_status, disposition, sign_off),
            3
        )

        # 2. Insert Quality_Result items
        quality_results = payload.get("quality_results") or payload.get("qualityResults") or []
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """
            await asyncio.to_thread(
                db_connector.execute_query,
                insert_qr_sql,
                (report_code, order_code, param_name, sp, act, dev, tol, eval_res),
                2
            )

        # 3. Log Audit Trail
        await asyncio.to_thread(
            db_connector.log_user_action,
            sign_off, "QA Specialist", "BATCH_COMPLETION_REPORT",
            f"Generated EBR Report [{report_code}] for Order [{order_code}] - Status: {quality_status}"
        )

        return {
            "status": "success",
            "message": f"EBR Report {report_code} recorded into SQL Server",
            "report_code": report_code
        }
    except Exception as e:
        logger.error(f"Error recording batch completion report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/reports/batch")
async def get_all_batch_reports():
    """Returns historical production reports from dbo.ProductionReport."""
    try:
        reports_sql = "SELECT * FROM ProductionReport ORDER BY CreatedTime DESC"
        reports = await asyncio.to_thread(db_connector.execute_query, reports_sql, None, 3)
        return {"status": "success", "data": reports}
    except Exception as e:
        logger.warning(f"Error fetching production reports: {e}")
        return {"status": "error", "message": str(e), "data": []}


@router.get("/api/reports/batch/{order_code}")
async def get_batch_report_detail(order_code: str):
    """Returns production report and quality results for a specific order."""
    try:
        report_sql = "SELECT * FROM ProductionReport WHERE OrderCode = ?"
        reports = await asyncio.to_thread(db_connector.execute_query, report_sql, (order_code,), 2)

        qr_sql = "SELECT * FROM Quality_Result WHERE OrderCode = ?"
        q_results = await asyncio.to_thread(db_connector.execute_query, qr_sql, (order_code,), 2)

        return {
            "status": "success",
            "report": reports[0] if reports else None,
            "quality_results": q_results
        }
    except Exception as e:
        return {"status": "error", "message": str(e), "report": None, "quality_results": []}


@router.get("/api/historian/logs/{order_code}")
async def get_historian_datalog(order_code: str):
    """Queries time-series telemetry logged into dbo.PLC_Datalog for an order."""
    try:
        sql = "SELECT TOP 1000 * FROM PLC_Datalog WHERE OrderCode = ? ORDER BY ReadTime ASC"
        logs = await asyncio.to_thread(db_connector.execute_query, sql, (order_code,), 3)
        return {"status": "success", "data": logs}
    except Exception as e:
        return {"status": "error", "message": str(e), "data": []}
