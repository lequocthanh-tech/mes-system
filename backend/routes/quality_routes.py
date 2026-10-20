"""
Quality Management & HACCP Production Engine Routes
ISA-95 Level 3 Quality Assurance Subsystem
Synchronized with SQL Server MES_Milk_Production & Shared Kepware OPC UA Singleton
"""

import os
import sys
import json
import time
import logging
import asyncio
from datetime import datetime, date, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

try:
    from db_connector import get_connection, execute_query
except ImportError:
    from backend.db_connector import get_connection, execute_query

logger = logging.getLogger("QualityRoutes")
quality_router = APIRouter(prefix="/api/quality", tags=["Quality Management"])

# ============================================================================
# DATA TRANSFER MODELS
# ============================================================================

class TestNodePayload(BaseModel):
    node_id: Optional[str] = ""

class QualityTagItem(BaseModel):
    node_id: Optional[str] = ""
    description: Optional[str] = ""
    unit: Optional[str] = "--"
    spec_min: Optional[float] = None
    spec_max: Optional[float] = None
    role: Optional[str] = None
    dataType: Optional[str] = "Float"

class QualityTagMappingUpdateRequest(BaseModel):
    tags: Optional[Dict[str, Any]] = None

# ============================================================================
# HELPER FUNCTIONS: OPC UA SINGLETON & PERSISTENCE ACCESS
# ============================================================================

def _get_kepware_gateway():
    """Retrieves central kepware_gateway singleton without spawning new sessions."""
    try:
        import kepware_gateway
        return kepware_gateway
    except ImportError:
        try:
            from backend import kepware_gateway
            return kepware_gateway
        except Exception as e:
            logger.warning(f"Could not import kepware_gateway: {e}")
            return None

def _get_tag_mappings_filepath() -> str:
    return os.path.join(backend_dir, "tag_mappings.json")

def _load_tag_mappings() -> Dict[str, Any]:
    path = _get_tag_mappings_filepath()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception as e:
        logger.error(f"Error loading tag mappings: {e}")
        return {}

def _save_tag_mappings(mappings: Dict[str, Any]) -> bool:
    path = _get_tag_mappings_filepath()
    try:
        tmp_path = f"{path}.tmp_{os.getpid()}_{time.time()}"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(mappings, f, indent=2, ensure_ascii=False)
        os.replace(tmp_path, path)
        return True
    except Exception as e:
        logger.error(f"Error saving tag mappings: {e}")
        return False

# ============================================================================
# PART 1: CENTRALIZED CONFIGURATION & PERSISTENT EMPTY TAG MAPPING
# ============================================================================

@quality_router.post("/tags/test-node")
async def test_quality_node_endpoint(payload: TestNodePayload):
    """
    Direct Probe on Shared OPC UA Connection:
    - Reads requested node_id directly from latest_cache["tags"] or invokes read on shared client.
    - If node_id is empty or unmapped: Return { "success": false, "quality": "Unmapped", "value": null }.
    - Never drops or restarts the shared OPC UA session.
    """
    raw_node_id = (payload.node_id or "").strip()
    if not raw_node_id or raw_node_id == "[CHƯA ÁNH XẠ]":
        return {
            "success": False,
            "quality": "Unmapped",
            "value": None,
            "message": "Node ID chưa được cấu hình"
        }

    gw = _get_kepware_gateway()
    if gw is None:
        return {
            "success": False,
            "quality": "Bad",
            "value": None,
            "message": "Kepware Gateway Bridge chưa sẵn sàng"
        }

    clean_nid = raw_node_id.replace("ns=2;s=", "").strip()

    # 1. Check shared latest_cache["tags"]
    cached_tag = (
        gw.latest_cache.get("tags", {}).get(raw_node_id)
        or gw.latest_cache.get("tags", {}).get(clean_nid)
        or gw.latest_cache.get("tags", {}).get(f"ns=2;s={clean_nid}")
    )
    if cached_tag and cached_tag.get("quality") == "Good" and cached_tag.get("value") is not None:
        raw_v = cached_tag.get("value")
        clean_v = round(float(raw_v), 2) if isinstance(raw_v, (int, float)) and not isinstance(raw_v, bool) else raw_v
        return {
            "success": True,
            "quality": "Good",
            "value": clean_v,
            "datatype": cached_tag.get("type", "Float"),
            "message": "Tín hiệu Node ID hợp lệ (Đọc từ bộ đệm Kepware cache)"
        }

    # 2. Live read directly through singleton OPC UA client (Zero new connections/sockets)
    try:
        opc_mgr = getattr(gw, "opc_mgr", None)
        if not opc_mgr or not opc_mgr.connected:
            return {
                "success": False,
                "quality": "Bad",
                "value": None,
                "message": "Kepware OPC UA Server hiện đang ngoại tuyến"
            }

        client = await opc_mgr.get_active_client()
        async with opc_mgr.lock:
            node = None
            try:
                node = client.get_node(raw_node_id)
            except Exception:
                if not raw_node_id.startswith("ns="):
                    node = client.get_node(f"ns=2;s={raw_node_id}")
                else:
                    raise

            data_val = await node.read_data_value()
            if data_val is not None:
                raw_val = data_val.Value.Value if (data_val and data_val.Value) else 0.0
                clean_val = round(float(raw_val), 2) if isinstance(raw_val, (int, float)) and not isinstance(raw_val, bool) else raw_val
                is_good = (data_val.StatusCode and data_val.StatusCode.is_good()) if data_val.StatusCode else True
                dtype = "Float"
                if hasattr(data_val.Value, "VariantType") and data_val.Value.VariantType:
                    dtype = data_val.Value.VariantType.name

                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                tag_entry = {
                    "tag_name": clean_nid,
                    "node_id": raw_node_id,
                    "value": clean_val,
                    "quality": "Good" if is_good else "Bad",
                    "type": dtype,
                    "timestamp": now_str
                }
                gw.latest_cache.setdefault("tags", {})[raw_node_id] = tag_entry
                if clean_nid and clean_nid != raw_node_id:
                    gw.latest_cache.setdefault("tags", {})[clean_nid] = tag_entry

                return {
                    "success": is_good,
                    "quality": "Good" if is_good else "Bad",
                    "value": clean_val if is_good else None,
                    "datatype": dtype,
                    "message": "Node ID kiểm tra thành công" if is_good else f"Bad ({data_val.StatusCode})"
                }
    except Exception as e:
        logger.warning(f"[QualityTags] Test node error for {raw_node_id}: {e}")
        return {
            "success": False,
            "quality": "Bad",
            "value": None,
            "message": f"Không thể đọc Node ID: {str(e)}"
        }

    return {
        "success": False,
        "quality": "Unmapped",
        "value": None,
        "message": "Node ID không tìm thấy trong danh mục Kepware"
    }


@quality_router.get("/tags/mapping")
async def get_quality_tag_mappings():
    """
    Returns current Quality tag mappings enriched with live readouts from shared Kepware cache.
    Empty nodes initialize with value: null and quality: 'Unmapped'.
    """
    gw = _get_kepware_gateway()
    all_mappings = _load_tag_mappings()
    quality_section = all_mappings.get("quality", {})

    cache = gw.latest_cache.get("tags", {}) if gw else {}
    server_connected = gw.latest_cache.get("server_connected", False) if gw else False

    enriched: Dict[str, Any] = {}
    default_quality_keys = {
        "inline_ph_pv": { "description": "Inline Milk Acidity (pH)", "unit": "pH", "spec_min": 6.5, "spec_max": 6.8 },
        "inline_brix_pv": { "description": "Refractometer Dissolved Brix", "unit": "°Bx", "spec_min": 11.5, "spec_max": 12.5 },
        "pasteur_hold_temp": { "description": "Pasteurizer Holding Tube Critical Temp (CCP-1)", "unit": "°C", "spec_min": 137.0, "spec_max": 140.0 }
    }

    # Merge configured with standard defaults
    merged_keys = dict(default_quality_keys)
    merged_keys.update(quality_section)

    for tag_key, meta in merged_keys.items():
        if not isinstance(meta, dict):
            meta = {"node_id": str(meta) if meta else ""}
        node_id = str(meta.get("node_id", "")).strip()

        if not node_id or node_id == "[CHƯA ÁNH XẠ]":
            live_val = None
            qual = "Unmapped"
            ts = "--:--:--"
        else:
            cached_item = cache.get(node_id, {}) or cache.get(node_id.replace("ns=2;s=", ""), {})
            live_val = cached_item.get("value")
            qual = cached_item.get("quality", "Good" if server_connected else "Bad")
            ts = cached_item.get("timestamp", "--:--:--")

        enriched[tag_key] = {
            "tag_name": tag_key,
            "node_id": node_id,
            "description": meta.get("description", f"Sensor {tag_key}"),
            "role": meta.get("description", f"Sensor {tag_key}"),
            "unit": meta.get("unit", "--"),
            "spec_min": meta.get("spec_min"),
            "spec_max": meta.get("spec_max"),
            "value": live_val,
            "quality": qual,
            "timestamp": ts,
            "dataType": "Float"
        }

    return {
        "status": "success",
        "module": "quality",
        "tags": enriched
    }


@quality_router.put("/tags/mapping")
async def update_quality_tag_mappings(payload: Dict[str, Any]):
    """
    Persists updated Quality inline sensor mappings:
    - Atomically writes to backend/tag_mappings.json under 'quality'
    - Synchronizes into dbo.Tag_Config in SQL Server with conn.commit()
    - Hot-reloads metadata in shared Kepware polling loop without server restart.
    """
    gw = _get_kepware_gateway()
    all_mappings = _load_tag_mappings()
    if "quality" not in all_mappings or not isinstance(all_mappings["quality"], dict):
        all_mappings["quality"] = {}

    tags_input = payload.get("tags") if ("tags" in payload and isinstance(payload["tags"], dict)) else payload
    cleaned_input = {k: v for k, v in tags_input.items() if isinstance(v, dict)}

    if not cleaned_input:
        raise HTTPException(status_code=400, detail="Dữ liệu ánh xạ tags không hợp lệ")

    # Update tag_mappings.json
    for tag_key, meta in cleaned_input.items():
        existing = all_mappings["quality"].get(tag_key, {})
        if not isinstance(existing, dict):
            existing = {}
        new_node = str(meta.get("node_id", "")).strip()
        existing["node_id"] = new_node
        if "description" in meta:
            existing["description"] = meta["description"]
        if "unit" in meta:
            existing["unit"] = meta["unit"]
        if "spec_min" in meta:
            existing["spec_min"] = meta["spec_min"]
        if "spec_max" in meta:
            existing["spec_max"] = meta["spec_max"]
        all_mappings["quality"][tag_key] = existing

        if new_node:
            try:
                import db_routes
                db_routes.propagate_tag_mapping_across_modules(tag_key, new_node)
            except Exception as prop_err:
                logger.warning(f"Quality tag cross-module propagation notice: {prop_err}")

    saved_file = _save_tag_mappings(all_mappings)
    if not saved_file:
        raise HTTPException(status_code=500, detail="Không thể lưu tập tin cấu hình tag_mappings.json")

    # Synchronize into dbo.Tag_Config in SQL Server with conn.commit()
    def _sync_sql():
        with get_connection() as conn:
            cursor = conn.cursor()
            for tag_key, meta in cleaned_input.items():
                nid = str(meta.get("node_id", "")).strip()
                unit = str(meta.get("unit", "--")).strip()
                desc = str(meta.get("description", tag_key)).strip()
                sql = """
                IF EXISTS (SELECT 1 FROM dbo.Tag_Config WHERE TagKey = ?)
                    UPDATE dbo.Tag_Config
                    SET OpcNodeId = ?, Unit = ?, RoleDescription = ?, Last_Update = GETDATE()
                    WHERE TagKey = ?;
                ELSE
                    INSERT INTO dbo.Tag_Config (TagKey, Module, OpcNodeId, Unit, RoleDescription, DataType, Last_Update)
                    VALUES (?, 'quality', ?, ?, ?, 'Float', GETDATE());
                """
                cursor.execute(sql, (tag_key, nid, unit, desc, tag_key, tag_key, nid, unit, desc))
            conn.commit()

    try:
        await asyncio.to_thread(_sync_sql)
    except Exception as sql_err:
        logger.warning(f"[QualityTags] SQL Server sync notice: {sql_err}")

    # Hot-reload in Kepware shared polling engine
    if gw is not None:
        try:
            gw.reload_tag_metadata()
            opc_mgr = getattr(gw, "opc_mgr", None)
            if opc_mgr and opc_mgr.connected:
                asyncio.create_task(opc_mgr.resubscribe())
        except Exception as reload_err:
            logger.warning(f"[QualityTags] Hot reload notice: {reload_err}")

    return {
        "status": "success",
        "message": "Cấu hình tag chất lượng đã được lưu và áp dụng thành công",
        "tags": all_mappings["quality"]
    }


# ============================================================================
# PART 2: DYNAMIC SUMMARY AGGREGATION & ZERO MOCK DATA
# ============================================================================

@quality_router.get("/summary")
async def get_quality_summary(
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """
    Dynamic Statistical Process Control (SPC) Aggregation Endpoint:
    - Queries dbo.Quality_Result, dbo.ProductionReport, and dbo.Recipes within date range.
    - Zero Mock Data: Displays actual production metrics or graceful zero-state fallbacks.
    """
    # 1. Normalize dates
    today = date.today()
    if not from_date or not isinstance(from_date, str):
        f_dt_str = (today - timedelta(days=30)).strftime("%Y-%m-%d 00:00:00")
    else:
        f_dt_str = from_date.strip()
        if len(f_dt_str) == 10:
            f_dt_str += " 00:00:00"

    if not to_date or not isinstance(to_date, str):
        t_dt_str = today.strftime("%Y-%m-%d 23:59:59")
    else:
        t_dt_str = to_date.strip()
        if len(t_dt_str) == 10:
            t_dt_str += " 23:59:59"

    def _execute_summary():
        with get_connection() as conn:
            cursor = conn.cursor()

            # --- A. Calculate Total Batches & Pass Rates ---
            # Try dbo.Quality_Result first using canonical columns (Evaluation, DeviationPercent, CheckedAt)
            cursor.execute("""
            SELECT 
                COUNT(*) AS TotalBatches,
                SUM(CASE WHEN UPPER(ISNULL(Evaluation, '')) = 'PASS' THEN 1 ELSE 0 END) AS PassBatches,
                SUM(CASE WHEN UPPER(ISNULL(Evaluation, '')) IN ('FAIL', 'QUARANTINED') THEN 1 ELSE 0 END) AS QuarantinedBatches,
                AVG(DeviationPercent) AS OverallAvgDeviation
            FROM dbo.Quality_Result
            WHERE CheckedAt BETWEEN ? AND ?;
            """, (f_dt_str, t_dt_str))
            qr_row = cursor.fetchone()

            total_batches = int(qr_row[0] or 0) if qr_row else 0
            pass_batches = int(qr_row[1] or 0) if qr_row and qr_row[1] is not None else 0
            quarantined_batches = int(qr_row[2] or 0) if qr_row and qr_row[2] is not None else 0
            overall_avg_dev = float(qr_row[3] or 0.0) if qr_row and qr_row[3] is not None else 0.0

            # Fallback to dbo.ProductionReport if Quality_Result has no records
            if total_batches == 0:
                cursor.execute("""
                SELECT 
                    COUNT(*) AS TotalBatches,
                    SUM(CASE WHEN UPPER(ISNULL(QualityStatus, '')) IN ('PASS', 'CONFORMING') THEN 1 ELSE 0 END) AS PassBatches,
                    SUM(CASE WHEN UPPER(ISNULL(QualityStatus, '')) IN ('FAIL', 'QUARANTINED') OR UPPER(ISNULL(DispositionAction, '')) = 'QUARANTINED' THEN 1 ELSE 0 END) AS QuarantinedBatches,
                    AVG(AvgDeviationPercent) AS OverallAvgDeviation
                FROM dbo.ProductionReport
                WHERE CreatedTime BETWEEN ? AND ?;
                """, (f_dt_str, t_dt_str))
                rep_row = cursor.fetchone()
                if rep_row and rep_row[0] > 0:
                    total_batches = int(rep_row[0] or 0)
                    pass_batches = int(rep_row[1] or 0) if rep_row[1] is not None else 0
                    quarantined_batches = int(rep_row[2] or 0) if rep_row[2] is not None else 0
                    overall_avg_dev = float(rep_row[3] or 0.0) if rep_row[3] is not None else 0.0

            # --- B. Calculate Total Inspected Volume ---
            cursor.execute("""
            SELECT COALESCE(SUM(TotalProduced), 0) AS TotalVolume
            FROM dbo.ProductionReport
            WHERE CreatedTime BETWEEN ? AND ?;
            """, (f_dt_str, t_dt_str))
            vol_row = cursor.fetchone()
            total_volume = float(vol_row[0] or 0.0) if vol_row else 0.0

            # --- C. Pareto Pass Rates by Recipe ---
            cursor.execute("""
            SELECT 
                COALESCE(r.Recipe_Name, q.RecipeApplied, 'Unknown Recipe') AS Recipe_Name,
                COALESCE(r.Recipe_Code, 'RCP-NA') AS Recipe_Code,
                COUNT(*) AS TotalBatches,
                SUM(CASE WHEN UPPER(ISNULL(q.QualityStatus, '')) IN ('PASS', 'CONFORMING') THEN 1 ELSE 0 END) AS PassBatches
            FROM dbo.ProductionReport q
            LEFT JOIN dbo.Recipes r ON q.RecipeApplied = r.Recipe_Name
            WHERE q.CreatedTime BETWEEN ? AND ?
            GROUP BY r.Recipe_Name, r.Recipe_Code, q.RecipeApplied;
            """, (f_dt_str, t_dt_str))
            pareto_rows = cursor.fetchall()

            pareto_list = []
            for r in pareto_rows:
                t_count = int(r[2] or 0)
                p_count = int(r[3] or 0)
                p_rate = round((p_count / t_count) * 100, 1) if t_count > 0 else 0.0
                pareto_list.append({
                    "recipe_name": str(r[0] or "Unknown"),
                    "recipe_code": str(r[1] or "RCP-NA"),
                    "pass_rate": p_rate,
                    "total_count": t_count,
                    "pass_count": p_count
                })

            # --- D. PART 3: Dynamic HACCP CAPA Engine & CCP Breaches ---
            cursor.execute("""
            SELECT TOP 10
                Detail_ID, Report_ID, ReportCode, OrderCode, ParameterName, PhaseId,
                Setpoint, ActualValue, DeviationPercent, ToleranceBand, Is_CCP_Breach, Result, Checked_At
            FROM dbo.Quality_Result_Detail
            WHERE (Is_CCP_Breach = 1 OR Result = 'FAIL')
            ORDER BY Checked_At DESC;
            """)
            breach_rows = cursor.fetchall()
            active_breaches = []
            for b in breach_rows:
                active_breaches.append({
                    "detail_id": b[0],
                    "report_id": b[1],
                    "report_code": b[2] or "--",
                    "order_code": b[3] or "--",
                    "parameter_name": b[4],
                    "phase_id": b[5] or "--",
                    "setpoint": float(b[6] or 0),
                    "actual_value": float(b[7] or 0),
                    "deviation_percent": float(b[8] or 0),
                    "tolerance_band": b[9] or "±1%",
                    "is_ccp_breach": bool(b[10]),
                    "result": b[11] or "FAIL",
                    "checked_at": b[12].strftime("%Y-%m-%d %H:%M:%S") if b[12] else "--"
                })

            # Also check if any ProductionReport is quarantined
            if not active_breaches and quarantined_batches > 0:
                cursor.execute("""
                SELECT TOP 5 Report_ID, ReportCode, OrderCode, RecipeApplied, AvgDeviationPercent, QualityStatus, CreatedTime
                FROM dbo.ProductionReport
                WHERE UPPER(ISNULL(QualityStatus, '')) IN ('FAIL', 'QUARANTINED')
                   OR UPPER(ISNULL(DispositionAction, '')) = 'QUARANTINED'
                ORDER BY CreatedTime DESC;
                """)
                for q_rep in cursor.fetchall():
                    active_breaches.append({
                        "detail_id": q_rep[0],
                        "report_id": q_rep[0],
                        "report_code": q_rep[1] or f"QAR-{q_rep[0]}",
                        "order_code": q_rep[2] or "WO-UNKNOWN",
                        "parameter_name": f"HACCP Criteria Non-Conformity ({q_rep[3] or 'Formula'})",
                        "phase_id": "PH_INSPECTION",
                        "setpoint": 0.0,
                        "actual_value": float(q_rep[4] or 0.0),
                        "deviation_percent": float(q_rep[4] or 0.0),
                        "tolerance_band": "±1%",
                        "is_ccp_breach": True,
                        "result": "FAIL",
                        "checked_at": q_rep[6].strftime("%Y-%m-%d %H:%M:%S") if q_rep[6] else "--"
                    })

            return {
                "total_batches": total_batches,
                "pass_batches": pass_batches,
                "quarantined_batches": quarantined_batches,
                "overall_avg_dev": overall_avg_dev,
                "total_volume": total_volume,
                "pareto_list": pareto_list,
                "active_breaches": active_breaches
            }

    try:
        data = await asyncio.to_thread(_execute_summary)
    except Exception as e:
        logger.error(f"[QualitySummary] SQL Aggregation Error: {e}")
        return {
            "status": "error",
            "message": str(e),
            "total_inspected_volume": 0.0,
            "fpy_percentage": 0.0,
            "quarantined_batches_count": 0,
            "quality_grade": "--",
            "total_batches": 0,
            "pass_batches": 0,
            "overall_avg_deviation": 0.0,
            "pareto_by_recipe": [],
            "active_breaches": [],
            "has_breach": False
        }

    total_b = data["total_batches"]
    pass_b = data["pass_batches"]
    fpy = round((pass_b / total_b) * 100, 1) if total_b > 0 else 0.0

    # Quality Grade calculation
    if total_b == 0:
        grade = "--"
    elif fpy >= 95.0:
        grade = "GRADE A"
    elif fpy >= 85.0:
        grade = "GRADE B"
    elif fpy > 0:
        grade = "GRADE C"
    else:
        grade = "GRADE D"

    return {
        "status": "success",
        "from_date": f_dt_str,
        "to_date": t_dt_str,
        "total_inspected_volume": data["total_volume"],
        "fpy_percentage": fpy,
        "quarantined_batches_count": data["quarantined_batches"],
        "quality_grade": grade,
        "total_batches": total_b,
        "pass_batches": pass_b,
        "overall_avg_deviation": round(data["overall_avg_dev"], 2),
        "pareto_by_recipe": data["pareto_list"],
        "active_breaches": data["active_breaches"],
        "has_breach": len(data["active_breaches"]) > 0
    }
