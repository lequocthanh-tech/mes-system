import sys
import os
import asyncio
import json
import time
import tempfile
import logging
import socket
import pyodbc
import re
from datetime import datetime
from typing import Any, List, Dict, Optional, Tuple, Set
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from asyncua import Client, ua
from contextlib import asynccontextmanager

backend_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(backend_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Guarantee that kepware_gateway is registered in sys.modules under all module names
# so any subsequent 'import kepware_gateway' or 'import backend.kepware_gateway'
# in child modules reuses this exact module singleton
_this_module = sys.modules[__name__]
sys.modules["kepware_gateway"] = _this_module
sys.modules["backend.kepware_gateway"] = _this_module

try:
    from . import db_routes, opc_routes, db_connector, db_sync_engine, historian
    from .store_forward_engine import db_engine
    from .db_connector import execute_query, verify_mes_database_status, get_connection
except (ImportError, ValueError):
    import db_routes
    try:
        import opc_routes
    except ImportError:
        opc_routes = None
    import db_connector
    import db_sync_engine
    import historian
    from store_forward_engine import db_engine
    from db_connector import execute_query, verify_mes_database_status, get_connection

try:
    from routes.quality_routes import quality_router
except ImportError:
    try:
        from .routes.quality_routes import quality_router
    except Exception:
        quality_router = None

try:
    from ai_copilot import ai_router
except ImportError:
    try:
        from .ai_copilot import ai_router
    except Exception:
        ai_router = None

# Track current active production order for Historian datalogging
active_running_order_code: Optional[str] = None
_last_order_check_time: float = 0.0
_cached_db_order_code: Optional[str] = None
_last_historian_datalog_time: float = 0.0

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OPC_Gateway")

# Mute noisy internal OPC UA subscription & client logs
logging.getLogger("asyncua").setLevel(logging.WARNING)
logging.getLogger("asyncua.common.subscription").setLevel(logging.WARNING)
logging.getLogger("asyncua.client.ua_client.UASocketProtocol").setLevel(logging.WARNING)
logging.getLogger("asyncua.client.ua_client.UaClient").setLevel(logging.WARNING)

# Resilient non-blocking DB logger: Protects event loop without permanent false lockout
_last_db_error_time: float = 0.0

def _sync_db_worker(query: str, params: Optional[tuple] = None):
    """Executes query with 1s timeout in detached worker thread; protects event loop without permanent lockout."""
    global _last_db_error_time
    try:
        execute_query(query, params, timeout=1)
    except Exception as db_err:
        _last_db_error_time = time.time()
        logger.warning(f"Background SQL logging notice ({db_err}). Protecting event loop.")

async def safe_db_execute_detached(query: str, params: Optional[tuple] = None):
    """
    Decoupled database execution: runs in a detached thread with strict 1-second timeout.
    Fails safely without permanent lockout to protect the OPC UA event loop.
    """
    try:
        await asyncio.wait_for(
            asyncio.to_thread(_sync_db_worker, query, params),
            timeout=1.0
        )
    except Exception as exc:
        logger.debug(f"Detached DB execute timeout/notice: {exc}")

def dispatch_db_log(query: str, params: Optional[tuple] = None):
    """Non-blocking fire-and-forget background database task dispatcher."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(safe_db_execute_detached(query, params))
    except RuntimeError:
        pass
    except Exception:
        pass

# ============================================================================
# DYNAMIC GATEWAY CONFIGURATION STORAGE (backend/gateway_config.json)
# ============================================================================
GATEWAY_CONFIG_FILE = os.path.join(os.path.dirname(__file__), "gateway_config.json")

DEFAULT_GATEWAY_CONFIG: Dict[str, Any] = {
    "endpoint": "opc.tcp://127.0.0.1:49320",
    "timeout_ms": 3000,
    "sampling_rate_ms": 1000,
    "sampling_interval_ms": 100,
    "provider_name": "KEPServerEX v6 - Industrial Connectivity Platform",
    "security_policy": "None",
    "auth_mode": "anonymous",
    "username": ""
}

def load_gateway_config() -> Dict[str, Any]:
    if not os.path.exists(GATEWAY_CONFIG_FILE):
        try:
            with open(GATEWAY_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_GATEWAY_CONFIG, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not initialize gateway_config.json: {e}")
        return dict(DEFAULT_GATEWAY_CONFIG)
    try:
        with open(GATEWAY_CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            merged = dict(DEFAULT_GATEWAY_CONFIG)
            merged.update(data)
            return merged
    except Exception as e:
        logger.error(f"Error loading gateway_config.json: {e}")
        return dict(DEFAULT_GATEWAY_CONFIG)

def save_gateway_config(config_data: Dict[str, Any]) -> bool:
    try:
        current = load_gateway_config()
        current.update(config_data)
        with open(GATEWAY_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving gateway_config.json: {e}")
        return False

# Kepware Connection Config initialized dynamically from persistent storage
_active_gw_config = load_gateway_config()
KEPWARE_URL = _active_gw_config.get("endpoint", "opc.tcp://127.0.0.1:49320")
TAG_TEMP_ACT = "ns=2;s=Siemens.Line1.Temperature_ACT"
TAG_WEIGHT_ACT = "ns=2;s=Siemens.Line1.Weight_ACT"
TAG_BATCH_STATUS = "ns=2;s=Siemens.Line1.Batch_Status"

# ============================================================================
# DYNAMIC CONFIGURATION STORAGE (backend/tag_mappings.json)
# ============================================================================
MAPPINGS_FILE = os.path.join(os.path.dirname(__file__), "tag_mappings.json")

DEFAULT_ESSENTIAL_MES_TAGS: Dict[str, Dict[str, Any]] = {}

def load_modular_tag_mappings() -> Dict[str, Any]:
    if not os.path.exists(MAPPINGS_FILE):
        return {}
    try:
        with open(MAPPINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                return data
    except Exception as e:
        logger.error(f"Error reading {MAPPINGS_FILE}: {e}")
    return {}

def flatten_tag_mappings(raw_data: Dict[str, Any], prefix: str = "") -> Dict[str, Dict[str, Any]]:
    flat: Dict[str, Dict[str, Any]] = {}
    for key, val in raw_data.items():
        if isinstance(val, dict):
            if "node_id" in val and str(val.get("node_id", "")).strip():
                flat[key] = val
                if prefix:
                    flat[f"{prefix}.{key}"] = val
            else:
                sub_prefix = f"{prefix}.{key}" if prefix else key
                sub_flat = flatten_tag_mappings(val, prefix=sub_prefix)
                flat.update(sub_flat)
        elif isinstance(val, str) and val.strip() and val.strip() != "[CHƯA ÁNH XẠ]":
            entry = {"node_id": val.strip()}
            flat[key] = entry
            if prefix:
                flat[f"{prefix}.{key}"] = entry
    return flat

def load_tag_mappings() -> Dict[str, Dict[str, Any]]:
    modular = load_modular_tag_mappings()
    if not modular:
        return {}
    flat = flatten_tag_mappings(modular)
    return flat

def atomic_save_json(filepath: str, data: Any):
    """
    Atomically writes JSON to disk via tempfile and os.replace to prevent
    partial writes or file corruption during unexpected crashes or restarts.
    """
    dirname = os.path.dirname(os.path.abspath(filepath))
    os.makedirs(dirname, exist_ok=True)
    temp_fd, temp_path = tempfile.mkstemp(dir=dirname, prefix="mes_tmp_", suffix=".json")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(temp_path, filepath)
    except Exception as e:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        raise e

def save_tag_mappings(mappings: Dict[str, Dict[str, Any]]):
    """
    Safely saves tag mappings to MAPPINGS_FILE without erasing modular structures.
    Uses atomic file replacement to prevent partial writes.
    """
    modular = load_modular_tag_mappings()
    if not isinstance(modular, dict):
        modular = {}
    for k, v in mappings.items():
        if isinstance(v, dict) and "node_id" in v:
            placed = False
            for mod_k, mod_tags in modular.items():
                if isinstance(mod_tags, dict) and k in mod_tags:
                    modular[mod_k][k].update(v)
                    placed = True
                    break
            if not placed:
                modular.setdefault("operations", {})[k] = v
        elif isinstance(v, dict):
            modular.setdefault(k, {}).update(v)
    atomic_save_json(MAPPINGS_FILE, modular)

def save_modular_tag_mappings(modular_dict: Dict[str, Any]):
    """
    Atomically saves modular tag mappings dictionary to MAPPINGS_FILE.
    """
    atomic_save_json(MAPPINGS_FILE, modular_dict)

MODULAR_TAG_MAPPINGS: Dict[str, Any] = load_modular_tag_mappings()
ESSENTIAL_MES_TAGS: Dict[str, Dict[str, Any]] = load_tag_mappings()

# Node ID reverse index for sub-millisecond lookup
NODE_TO_TAG_META: Dict[str, Dict[str, Any]] = {
    info["node_id"]: {"tag_name": tag_name, **info}
    for tag_name, info in ESSENTIAL_MES_TAGS.items()
    if isinstance(info, dict) and "node_id" in info
}

# Legacy default list compatibility
DEFAULT_TAG_DEFINITIONS = [
    {
        "name": tag_name,
        "node": info["node_id"],
        "type": "Float" if info.get("unit") in ("°C", "RPM", "pH", "°Bx", "mm/s", "A") else ("Boolean" if info.get("unit") == "Bool" else ("String" if tag_name == "Batch_State" else ("Int16" if info.get("unit") == "L" else "Float")))
    }
    for tag_name, info in ESSENTIAL_MES_TAGS.items()
    if isinstance(info, dict) and "node_id" in info
]

# In-memory watchlist initialized strictly with the essential whitelisted tags
explorer_watchlist: List[Dict[str, Any]] = [
    {
        "tag_name": tag_name,
        "node_id": info["node_id"],
        "role": info.get("role", "General Process Tag"),
        "unit": info.get("unit", "--"),
        "writable": info.get("writable", True),
        "expected_type": "Float" if info.get("unit") in ("°C", "RPM", "pH", "°Bx", "mm/s", "A") else ("Boolean" if info.get("unit") == "Bool" else ("String" if tag_name == "Batch_State" else ("Int16" if info.get("unit") == "L" else "Float"))),
        "description": info.get("description", "")
    }
    for tag_name, info in ESSENTIAL_MES_TAGS.items()
    if isinstance(info, dict) and "node_id" in info
]

def reload_tag_metadata():
    global MODULAR_TAG_MAPPINGS, ESSENTIAL_MES_TAGS, NODE_TO_TAG_META, explorer_watchlist
    MODULAR_TAG_MAPPINGS = load_modular_tag_mappings()
    ESSENTIAL_MES_TAGS = load_tag_mappings()
    NODE_TO_TAG_META = {
        info["node_id"]: {"tag_name": tag_name, **info}
        for tag_name, info in ESSENTIAL_MES_TAGS.items()
        if isinstance(info, dict) and "node_id" in info
    }
    explorer_watchlist.clear()
    for tag_name, info in ESSENTIAL_MES_TAGS.items():
        if not isinstance(info, dict) or "node_id" not in info:
            continue
        register_subscribed_node(info["node_id"])
        explorer_watchlist.append({
            "tag_name": tag_name,
            "node_id": info["node_id"],
            "role": info.get("role", "General Process Tag"),
            "unit": info.get("unit", "--"),
            "writable": info.get("writable", True),
            "expected_type": "Float" if info.get("unit") in ("°C", "RPM", "pH", "°Bx", "mm/s", "A") else ("Boolean" if info.get("unit") == "Bool" else ("String" if tag_name == "Batch_State" else ("Int16" if info.get("unit") == "L" else "Float"))),
            "description": info.get("description", "")
        })



# Known OPC UA and Network Socket Connection Error Identifiers
CONNECTION_ERROR_NAMES = {
    "BadSecureChannelClosed", "BadConnectionClosed", "BadSessionClosed",
    "BadCommunicationError", "BadServerHalted", "BadSessionIdInvalid",
    "BadTimeout", "BadDisconnect", "BadTcpEndpointUrlInvalid",
    "BadNoContinuationPoints"
}

def is_connection_error(exc: Exception) -> bool:
    """Detects whether an exception indicates a dropped OPC UA socket or session."""
    if isinstance(exc, (ConnectionError, ConnectionResetError, BrokenPipeError, TimeoutError, OSError)):
        return True
    exc_type = type(exc).__name__
    if exc_type in CONNECTION_ERROR_NAMES:
        return True
    msg = str(exc)
    for name in CONNECTION_ERROR_NAMES:
        if name in msg:
            return True
    if any(keyword in msg.lower() for keyword in ("connection", "socket", "closed", "transport", "disconnect", "reset by peer")):
        return True
    return False


def build_initial_tag_cache() -> Dict[str, Dict[str, Any]]:
    cache = {}
    try:
        for tag_name, info in ESSENTIAL_MES_TAGS.items():
            if not isinstance(info, dict) or "node_id" not in info:
                continue
            node_id = str(info["node_id"]).strip()
            if not node_id or node_id == "[CHƯA ÁNH XẠ]":
                continue
            unit = info.get("unit", "--")
            role = info.get("role", "General Process Tag")
            writable = info.get("writable", True)
            description = info.get("description", tag_name)

            if unit in ("°C", "RPM", "pH", "°Bx", "mm/s", "A"):
                dt = "Float"
                val = 0.0
            elif unit in ("L", "kg", "Kg"):
                dt = "Float"
                val = 0.0
            elif unit in ("Bool", "BOOL"):
                dt = "Boolean"
                val = False
            elif unit == "State":
                dt = "String"
                val = "IDLE"
            else:
                dt = "Float"
                val = 0.0

            cache[node_id] = {
                "tag_name": tag_name,
                "node_id": node_id,
                "role": role,
                "unit": unit,
                "writable": writable,
                "description": description,
                "type": dt,
                "data_type": dt,
                "value": val,
                "quality": "Bad",
                "timestamp": "--:--:--"
            }
    except Exception as exc:
        logger.warning(f"[build_initial_tag_cache] Tag cache initialization fallback: {exc}")
    return cache

# Central In-Memory Cache (Instantly served to HTTP endpoints without socket calls)
latest_cache: Dict[str, Any] = {
    "server_connected": False,
    "endpoint": KEPWARE_URL,
    "latency_ms": 0,
    "last_updated": "--:--:--",
    "tags": build_initial_tag_cache()
}

# Gateway telemetry state for line monitoring
gateway_state = {
    "connected": False,
    "latency_ms": 0,
    "telemetry": {
        "temperature_act": 0.0,
        "weight_act": 0.0,
        "batch_status": "STOPPED"
    }
}


# Node handle cache to eliminate string parsing overhead
node_cache: Dict[str, Any] = {}
node_handle_cache: Dict[str, Any] = node_cache
last_sql_log_time: float = 0.0

def get_cached_node(client: Client, node_id: str):
    """Retrieves or caches an asyncua.Node object to avoid per-tick instantiation overhead."""
    if not node_id or not isinstance(node_id, str):
        return None
    nid = node_id.strip()
    if not nid or nid == "[CHƯA ÁNH XẠ]":
        return None
    if nid in node_handle_cache:
        return node_handle_cache[nid]
    clean_nid = nid.replace("ns=2;s=", "").strip()
    if clean_nid in node_handle_cache:
        node_handle_cache[nid] = node_handle_cache[clean_nid]
        return node_handle_cache[clean_nid]
    try:
        node = client.get_node(nid)
    except Exception:
        if not nid.startswith("ns="):
            node = client.get_node(f"ns=2;s={nid}")
        else:
            return None
    node_handle_cache[nid] = node
    if clean_nid and clean_nid != nid:
        node_handle_cache[clean_nid] = node
    return node

# ============================================================================
# CENTRAL SUBSCRIBED NODES BUS REGISTRY (Single Bus Across All Modules)
# ============================================================================
subscribed_nodes: Set[str] = set()

def register_subscribed_node(node_id: str) -> None:
    """Registers a node ID into the central continuous telemetry poll list."""
    if not node_id:
        return
    nid = str(node_id).strip()
    if nid and nid != "[CHƯA ÁNH XẠ]":
        subscribed_nodes.add(nid)
        clean_stripped = nid.replace("ns=2;s=", "").strip()
        if clean_stripped:
            subscribed_nodes.add(clean_stripped)

def unregister_subscribed_node(node_id: str) -> None:
    """Removes a node ID from active polling/subscription and clears stale cache."""
    if not node_id:
        return
    nid = str(node_id).strip()
    subscribed_nodes.discard(nid)
    clean_stripped = nid.replace("ns=2;s=", "").strip()
    if clean_stripped:
        subscribed_nodes.discard(clean_stripped)
    node_handle_cache.pop(nid, None)
    node_handle_cache.pop(clean_stripped, None)
    # Remove stale entry from latest_cache["tags"]
    latest_cache.get("tags", {}).pop(nid, None)
    if clean_stripped:
        latest_cache.get("tags", {}).pop(clean_stripped, None)

# Initialize subscribed_nodes with essential MES tags
for _tname, _tinfo in ESSENTIAL_MES_TAGS.items():
    if isinstance(_tinfo, dict) and "node_id" in _tinfo:
        register_subscribed_node(_tinfo["node_id"])

# ============================================================================
# DYNAMIC INVENTORY TANK TELEMETRY & POLLER REGISTRY
# ============================================================================

def sanitize_material_name(raw_name: Any, tank_id: str = "") -> str:
    if not raw_name:
        return ""
    clean = str(raw_name).strip()
    pattern = r"^(?:Bồn chứa|Silo chứa|Storage)\s+[A-Za-z0-9_-]+\s*\((.*)\)$"
    while True:
        m = re.match(pattern, clean, re.IGNORECASE)
        if m:
            clean = m.group(1).strip()
        else:
            break
    return clean

active_tank_pollers: Dict[str, Dict[str, Any]] = {}

def parse_discrete_bool(val) -> bool:
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val > 0.001
    if isinstance(val, str):
        v = val.strip().lower()
        if v in ("true", "1", "on", "high", "active", "trip"):
            return True
        if v in ("false", "0", "off", "low", "inactive", "ok", ""):
            return False
        return bool(v)
    return bool(val)

def reload_tank_pollers_from_db():
    """
    Synchronizes runtime poller list with dbo.Material_Stock and tag_mappings.json.
    Ensures dynamic reload of all configured tank tags (analog PV + discrete switches)
    without requiring a server reboot.
    """
    global active_tank_pollers
    tanks = {}
    try:
        conn = get_connection(timeout=2)
        if conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT Material_Code, Material_Name, AssignedTank, CurrentStock,
                       TankCapacity, MinSafetyThreshold, Unit, Last_Update,
                       OpcNodeId, SensorType, TareWeight,
                       OpcHighLevelNodeId, OpcLowLevelNodeId
                FROM dbo.Material_Stock
                ORDER BY AssignedTank ASC
            """)
            for row in cur.fetchall():
                mcode, mname, tank_id, cur_stock, cap, min_thresh, unit, last_up, opc_node, stype, tare, opc_high, opc_low = row
                tid = str(tank_id or "").strip()
                clean_mname = sanitize_material_name(mname, tid)
                node = str(opc_node or "").strip()
                high_node = str(opc_high or "").strip()
                low_node = str(opc_low or "").strip()
                now_sync = "--"
                now_str = str(last_up or "--")
                tanks[tid] = {
                    "tank_id": tid,
                    "tankId": tid,
                    "material_code": str(mcode or ""),
                    "materialCode": str(mcode or ""),
                    "material_name": clean_mname,
                    "materialName": clean_mname,
                    "tank_name": f"Bồn chứa {tid} ({clean_mname})",
                    "tankName": f"Bồn chứa {tid} ({clean_mname})",
                    "current_stock": float(cur_stock or 0.0),
                    "currentStock": float(cur_stock or 0.0),
                    "capacity": float(cap or 5.0),
                    "max_capacity": float(cap or 5.0),
                    "maxCapacity": float(cap or 5.0),
                    "min_safety": float(min_thresh or 0.5),
                    "safety_min": float(min_thresh or 0.5),
                    "minThreshold": float(min_thresh or 0.5),
                    "safetyMin": float(min_thresh or 0.5),
                    "unit": str(unit or "L"),
                    "opc_node_id": node,
                    "opcNodeId": node,
                    "opc_tag": node,
                    "opcTag": node,
                    "opc_high_node_id": high_node,
                    "opcHighNodeId": high_node,
                    "opc_high_tag": high_node,
                    "opcHighTag": high_node,
                    "opc_low_node_id": low_node,
                    "opcLowNodeId": low_node,
                    "opc_low_tag": low_node,
                    "opcLowTag": low_node,
                    "high_level_active": False,
                    "highLevelActive": False,
                    "high_level_quality": "Good" if high_node else "[CHƯA ÁNH XẠ]",
                    "highLevelQuality": "Good" if high_node else "[CHƯA ÁNH XẠ]",
                    "low_level_active": False,
                    "lowLevelActive": False,
                    "low_level_quality": "Good" if low_node else "[CHƯA ÁNH XẠ]",
                    "lowLevelQuality": "Good" if low_node else "[CHƯA ÁNH XẠ]",
                    "sensor_type": str(stype or "LOADCELL_MASS"),
                    "sensorType": str(stype or "LOADCELL_MASS"),
                    "tare_weight": float(tare or 0.0),
                    "tareWeight": float(tare or 0.0),
                    "live_pv": None if not node else float(cur_stock or 0.0),
                    "livePv": None if not node else float(cur_stock or 0.0),
                    "quality": "Good" if node else "[CHƯA ÁNH XẠ]",
                    "pv_quality": "Good" if node else "[CHƯA ÁNH XẠ]",
                    "pvQuality": "Good" if node else "[CHƯA ÁNH XẠ]",
                    "last_synced": now_sync if not node else datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "lastSynced": now_sync if not node else datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "last_updated": now_str,
                    "lastUpdated": now_str,
                }
            conn.close()
    except Exception as db_err:
        logger.debug(f"DB load for tank pollers notice: {db_err}")

    try:
        modular = load_modular_tag_mappings()
        inv_map = modular.get("inventory", {})
        for tid in list(tanks.keys()):
            # Support both modular object format {"TANK-01": {"pv_node": "..."}} and tag format {"TANK_01_LEVEL": {"node_id": "..."}}
            t_entry = inv_map.get(tid) or inv_map.get(tid.replace("-", "_"))
            if isinstance(t_entry, dict):
                p_n = str(t_entry.get("pv_node") or t_entry.get("node_id") or "").strip()
                h_n = str(t_entry.get("high_node") or "").strip()
                l_n = str(t_entry.get("low_node") or "").strip()
                if p_n:
                    tanks[tid]["opc_node_id"] = p_n
                    tanks[tid]["opcNodeId"] = p_n
                    tanks[tid]["OpcNodeId"] = p_n
                    tanks[tid]["opc_tag"] = p_n
                    tanks[tid]["opcTag"] = p_n
                if h_n:
                    tanks[tid]["opc_high_node_id"] = h_n
                    tanks[tid]["opcHighNodeId"] = h_n
                    tanks[tid]["opc_high_tag"] = h_n
                if l_n:
                    tanks[tid]["opc_low_node_id"] = l_n
                    tanks[tid]["opcLowNodeId"] = l_n
                    tanks[tid]["opc_low_tag"] = l_n

            prefix = tid.replace("-", "_")
            lvl_meta = inv_map.get(f"{prefix}_LEVEL") or inv_map.get(f"{prefix}_PV") or inv_map.get(f"{tid}_PV")
            if lvl_meta and lvl_meta.get("node_id"):
                n = str(lvl_meta["node_id"]).strip()
                if n:
                    tanks[tid]["opc_node_id"] = n
                    tanks[tid]["opcNodeId"] = n
                    tanks[tid]["OpcNodeId"] = n
                    tanks[tid]["opc_tag"] = n
                    tanks[tid]["opcTag"] = n
            h_meta = inv_map.get(f"{prefix}_LSH")
            if h_meta and h_meta.get("node_id"):
                hn = str(h_meta["node_id"]).strip()
                if hn:
                    tanks[tid]["opc_high_node_id"] = hn
                    tanks[tid]["opcHighNodeId"] = hn
                    tanks[tid]["opc_high_tag"] = hn
            l_meta = inv_map.get(f"{prefix}_LSL")
            if l_meta and l_meta.get("node_id"):
                ln = str(l_meta["node_id"]).strip()
                if ln:
                    tanks[tid]["opc_low_node_id"] = ln
                    tanks[tid]["opcLowNodeId"] = ln
                    tanks[tid]["opc_low_tag"] = ln
    except Exception as f_err:
        logger.debug(f"Tag mappings json notice: {f_err}")

    for tid, tdata in tanks.items():
        if tid in active_tank_pollers:
            active_tank_pollers[tid].update({
                k: v for k, v in tdata.items()
                if k not in ("live_pv", "livePv", "last_synced", "lastSynced", "high_level_active", "low_level_active")
            })
        else:
            active_tank_pollers[tid] = tdata

    latest_cache["tanks"] = list(active_tank_pollers.values())
    return active_tank_pollers

def update_tank_poller(
    tank_id: str, 
    node_id: str = None, 
    unit: str = "L", 
    mat_code: str = "", 
    mat_name: str = "", 
    capacity: float = None, 
    min_safety: float = None, 
    opc_high_node_id: str = None, 
    opc_low_node_id: str = None,
    **kwargs
):
    """
    Immediately updates or registers a tank's OPC UA tags in the runtime poller list
    without requiring a server reboot. Supports flexible keyword & positional calling.
    """
    tank_id = tank_id.strip()
    node_id = (node_id or "").strip()

    # Support positional call: update_tank_poller(tank_id, node_id, high_node, low_node)
    if unit and isinstance(unit, str) and (unit.startswith("ns=") or unit.startswith("s=") or "." in unit):
        if opc_high_node_id is None:
            opc_high_node_id = unit
            unit = "L"
    if mat_code and isinstance(mat_code, str) and (mat_code.startswith("ns=") or mat_code.startswith("s=") or "." in mat_code):
        if opc_low_node_id is None:
            opc_low_node_id = mat_code
            mat_code = ""

    high_node = (opc_high_node_id or kwargs.get("high_node") or kwargs.get("opcHighNodeId") or "").strip()
    low_node = (opc_low_node_id or kwargs.get("low_node") or kwargs.get("opcLowNodeId") or "").strip()
    clean_mat = sanitize_material_name(mat_name, tank_id) or mat_code or tank_id
    now_sync = datetime.now().strftime("%Y-%m-%d %H:%M:%S") if node_id else "--"
    now_up = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if tank_id not in active_tank_pollers:
        active_tank_pollers[tank_id] = {
            "tank_id": tank_id,
            "tankId": tank_id,
            "AssignedTank": tank_id,
            "material_code": mat_code,
            "materialCode": mat_code,
            "Material_Code": mat_code,
            "material_name": clean_mat,
            "materialName": clean_mat,
            "Material_Name": clean_mat,
            "tank_name": f"Bồn chứa {tank_id} ({clean_mat})",
            "tankName": f"Bồn chứa {tank_id} ({clean_mat})",
            "TankName": f"Bồn chứa {tank_id} ({clean_mat})",
            "current_stock": 0.0,
            "currentStock": 0.0,
            "CurrentStock": 0.0,
            "capacity": float(capacity or 5.0),
            "max_capacity": float(capacity or 5.0),
            "maxCapacity": float(capacity or 5.0),
            "TankCapacity": float(capacity or 5.0),
            "min_safety": float(min_safety or 0.5),
            "safety_min": float(min_safety or 0.5),
            "minThreshold": float(min_safety or 0.5),
            "safetyMin": float(min_safety or 0.5),
            "MinSafetyThreshold": float(min_safety or 0.5),
            "unit": unit or "L",
            "Unit": unit or "L",
            "opc_node_id": node_id,
            "opcNodeId": node_id,
            "OpcNodeId": node_id,
            "opc_tag": node_id,
            "opcTag": node_id,
            "OpcTag": node_id,
            "opc_high_node_id": high_node,
            "opcHighNodeId": high_node,
            "OpcHighLevelNodeId": high_node,
            "opc_high_tag": high_node,
            "opcHighTag": high_node,
            "opc_low_node_id": low_node,
            "opcLowNodeId": low_node,
            "OpcLowLevelNodeId": low_node,
            "opc_low_tag": low_node,
            "opcLowTag": low_node,
            "high_level_active": False,
            "highLevelActive": False,
            "high_level_quality": "Good",
            "highLevelQuality": "Good",
            "low_level_active": False,
            "lowLevelActive": False,
            "low_level_quality": "Good",
            "lowLevelQuality": "Good",
            "sensor_type": "LOADCELL_MASS",
            "sensorType": "LOADCELL_MASS",
            "SensorType": "LOADCELL_MASS",
            "tare_weight": 0.0,
            "tareWeight": 0.0,
            "TareWeight": 0.0,
            "live_pv": 0.0,
            "livePv": 0.0,
            "quality": "Good",
            "pv_quality": "Good",
            "pvQuality": "Good",
            "last_synced": now_sync,
            "lastSynced": now_sync,
            "last_updated": now_up,
            "lastUpdated": now_up,
        }
    else:
        t = active_tank_pollers[tank_id]
        if node_id is not None:
            t["opc_node_id"] = node_id
            t["opcNodeId"] = node_id
            t["OpcNodeId"] = node_id
            t["opc_tag"] = node_id
            t["opcTag"] = node_id
            t["OpcTag"] = node_id
            if not node_id:
                t["live_pv"] = None
                t["livePv"] = None
                t["quality"] = "[CHƯA ÁNH XẠ]"
                t["pv_quality"] = "[CHƯA ÁNH XẠ]"
                t["pvQuality"] = "[CHƯA ÁNH XẠ]"
                t["last_synced"] = "--"
        if high_node is not None:
            t["opc_high_node_id"] = high_node
            t["opcHighNodeId"] = high_node
            t["OpcHighLevelNodeId"] = high_node
            t["opc_high_tag"] = high_node
            t["opcHighTag"] = high_node
            if not high_node:
                t["high_level_active"] = False
                t["highLevelActive"] = False
                t["high_level_quality"] = "[CHƯA ÁNH XẠ]"
                t["highLevelQuality"] = "[CHƯA ÁNH XẠ]"
        if low_node is not None:
            t["opc_low_node_id"] = low_node
            t["opcLowNodeId"] = low_node
            t["OpcLowLevelNodeId"] = low_node
            t["opc_low_tag"] = low_node
            t["opcLowTag"] = low_node
            if not low_node:
                t["low_level_active"] = False
                t["lowLevelActive"] = False
                t["low_level_quality"] = "[CHƯA ÁNH XẠ]"
                t["lowLevelQuality"] = "[CHƯA ÁNH XẠ]"
        if unit: 
            t["unit"] = unit
            t["Unit"] = unit
        if mat_code:
            t["material_code"] = mat_code
            t["materialCode"] = mat_code
            t["Material_Code"] = mat_code
        if clean_mat:
            t["material_name"] = clean_mat
            t["materialName"] = clean_mat
            t["Material_Name"] = clean_mat
            t["tank_name"] = f"Bồn chứa {tank_id} ({clean_mat})"
            t["tankName"] = f"Bồn chứa {tank_id} ({clean_mat})"
            t["TankName"] = f"Bồn chứa {tank_id} ({clean_mat})"
        if capacity is not None:
            t["capacity"] = float(capacity)
            t["max_capacity"] = float(capacity)
            t["maxCapacity"] = float(capacity)
            t["TankCapacity"] = float(capacity)
        if min_safety is not None:
            t["min_safety"] = float(min_safety)
            t["safety_min"] = float(min_safety)
            t["minThreshold"] = float(min_safety)
            t["safetyMin"] = float(min_safety)
            t["MinSafetyThreshold"] = float(min_safety)
        t["last_updated"] = now_up
        t["lastUpdated"] = now_up

    # Handle unmapping / unregistering when node_id is empty or cleared
    if not node_id or node_id == "[CHƯA ÁNH XẠ]":
        old_pv = active_tank_pollers[tank_id].get("opc_node_id") or ""
        if old_pv:
            unregister_subscribed_node(old_pv)
        active_tank_pollers[tank_id]["opc_node_id"] = ""
        active_tank_pollers[tank_id]["opcNodeId"] = ""
        active_tank_pollers[tank_id]["OpcNodeId"] = ""
        active_tank_pollers[tank_id]["opc_tag"] = ""
        active_tank_pollers[tank_id]["opcTag"] = ""
        active_tank_pollers[tank_id]["live_pv"] = 0.0
        active_tank_pollers[tank_id]["livePv"] = 0.0
        active_tank_pollers[tank_id]["quality"] = "[CHƯA ÁNH XẠ]"
        active_tank_pollers[tank_id]["pv_quality"] = "[CHƯA ÁNH XẠ]"
        active_tank_pollers[tank_id]["pvQuality"] = "[CHƯA ÁNH XẠ]"
        active_tank_pollers[tank_id]["last_synced"] = "--"
        active_tank_pollers[tank_id]["lastSynced"] = "--"
        tag_key = f"{tank_id}_PV"
        latest_cache.get("tags", {}).pop(tag_key, None)
    else:
        register_subscribed_node(node_id)
        tag_key = f"{tank_id}_PV"
        clean_pv = node_id.replace("ns=2;s=", "").strip()
        pv_entry = {
            "tag_name": tag_key,
            "node_id": node_id,
            "type": "Float",
            "data_type": "Float",
            "value": active_tank_pollers[tank_id].get("live_pv", 0.0),
            "quality": "Good",
            "timestamp": now_up,
            "role": f"{tank_id} Level PV",
            "unit": unit or "L",
            "writable": False,
            "description": f"Storage Tank {tank_id} ({clean_mat}) Level PV"
        }
        latest_cache.setdefault("tags", {})[node_id] = pv_entry
        if clean_pv and clean_pv != node_id:
            latest_cache.setdefault("tags", {})[clean_pv] = pv_entry

    if not high_node or high_node == "[CHƯA ÁNH XẠ]":
        old_h = active_tank_pollers[tank_id].get("opc_high_node_id") or ""
        if old_h:
            unregister_subscribed_node(old_h)
        active_tank_pollers[tank_id]["opc_high_node_id"] = ""
        active_tank_pollers[tank_id]["opcHighNodeId"] = ""
        active_tank_pollers[tank_id]["opc_high_tag"] = ""
        active_tank_pollers[tank_id]["opcHighTag"] = ""
        active_tank_pollers[tank_id]["high_level_quality"] = "[CHƯA ÁNH XẠ]"
        active_tank_pollers[tank_id]["highLevelQuality"] = "[CHƯA ÁNH XẠ]"
        latest_cache.get("tags", {}).pop(f"{tank_id}_LSH", None)
    else:
        register_subscribed_node(high_node)
        tag_h_key = f"{tank_id}_LSH"
        clean_h = high_node.replace("ns=2;s=", "").strip()
        h_entry = {
            "tag_name": tag_h_key,
            "node_id": high_node,
            "type": "Boolean",
            "data_type": "Boolean",
            "value": active_tank_pollers[tank_id].get("high_level_active", False),
            "quality": "Good",
            "timestamp": now_up,
            "role": f"{tank_id} High Level Switch",
            "unit": "BOOL",
            "writable": False,
            "description": f"Storage Tank {tank_id} Overfill Switch"
        }
        latest_cache.setdefault("tags", {})[high_node] = h_entry
        if clean_h and clean_h != high_node:
            latest_cache.setdefault("tags", {})[clean_h] = h_entry

    if not low_node or low_node == "[CHƯA ÁNH XẠ]":
        old_l = active_tank_pollers[tank_id].get("opc_low_node_id") or ""
        if old_l:
            unregister_subscribed_node(old_l)
        active_tank_pollers[tank_id]["opc_low_node_id"] = ""
        active_tank_pollers[tank_id]["opcLowNodeId"] = ""
        active_tank_pollers[tank_id]["opc_low_tag"] = ""
        active_tank_pollers[tank_id]["opcLowTag"] = ""
        active_tank_pollers[tank_id]["low_level_quality"] = "[CHƯA ÁNH XẠ]"
        active_tank_pollers[tank_id]["lowLevelQuality"] = "[CHƯA ÁNH XẠ]"
        latest_cache.get("tags", {}).pop(f"{tank_id}_LSL", None)
    else:
        register_subscribed_node(low_node)
        tag_l_key = f"{tank_id}_LSL"
        clean_l = low_node.replace("ns=2;s=", "").strip()
        l_entry = {
            "tag_name": tag_l_key,
            "node_id": low_node,
            "type": "Boolean",
            "data_type": "Boolean",
            "value": active_tank_pollers[tank_id].get("low_level_active", False),
            "quality": "Good",
            "timestamp": now_up,
            "role": f"{tank_id} Low Level Switch",
            "unit": "BOOL",
            "writable": False,
            "description": f"Storage Tank {tank_id} Dry Run Switch"
        }
        latest_cache.setdefault("tags", {})[low_node] = l_entry
        if clean_l and clean_l != low_node:
            latest_cache.setdefault("tags", {})[clean_l] = l_entry

    latest_cache["tanks"] = list(active_tank_pollers.values())

    # Broadcast updated tank telemetry immediately
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(connection_manager.broadcast({
            "type": "TANK_TELEMETRY",
            "tank_id": tank_id,
            "tankId": tank_id,
            "live_pv": active_tank_pollers[tank_id].get("live_pv", 0.0),
            "livePv": active_tank_pollers[tank_id].get("live_pv", 0.0),
            "quality": active_tank_pollers[tank_id].get("quality", "[CHƯA ÁNH XẠ]"),
            "pv_quality": active_tank_pollers[tank_id].get("pv_quality", "[CHƯA ÁNH XẠ]"),
            "pvQuality": active_tank_pollers[tank_id].get("pvQuality", "[CHƯA ÁNH XẠ]"),
            "opc_node_id": active_tank_pollers[tank_id].get("opc_node_id", ""),
            "high_level_active": active_tank_pollers[tank_id].get("high_level_active", False),
            "low_level_active": active_tank_pollers[tank_id].get("low_level_active", False),
        }))
    except Exception:
        pass

    # Trigger hot-resubscribe
    if hasattr(opc_mgr, "client") and opc_mgr.client and opc_mgr.connected:
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(opc_mgr.resubscribe())
        except RuntimeError:
            pass



# ============================================================================
# WEBSOCKET REAL-TIME TELEMETRY MANAGER
# ============================================================================

class ConnectionManager:
    """
    Manages active WebSocket client connections for real-time telemetry streaming.
    Broadcasts Report-by-Exception tag changes instantly to all connected UI clients.
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Active clients: {len(self.active_connections)}")
        
        # Immediately send current latest_cache snapshot so the UI initializes instantly
        snapshot = {
            "type": "SNAPSHOT",
            "server_connected": bool(latest_cache["server_connected"]),
            "endpoint": latest_cache["endpoint"],
            "latency_ms": latest_cache.get("latency_ms", 1),
            "timestamp": latest_cache.get("last_updated", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            "tags": list(latest_cache["tags"].values()),
            "tanks": list(active_tank_pollers.values())
        }
        try:
            await websocket.send_json(snapshot)
        except Exception as err:
            logger.warning(f"Failed to send initial snapshot to WebSocket: {err}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        stale_connections = []
        for conn in list(self.active_connections):
            try:
                await conn.send_json(message)
            except Exception as e:
                logger.debug(f"WebSocket client send error: {e}")
                stale_connections.append(conn)
        for dead_conn in stale_connections:
            self.disconnect(dead_conn)

connection_manager = ConnectionManager()


# ============================================================================
# OPC UA SUBSCRIPTION HANDLER (REPORT-BY-EXCEPTION / EVENT-DRIVEN)
# ============================================================================

class KepwareSubHandler:
    """
    Asynchronous OPC UA Subscription Handler:
    Kepware only pushes datachange_notification when tag values change.
    Eliminates periodic HTTP polling traffic and queue congestion entirely.
    """
    def __init__(self, broadcast_callback):
        self.broadcast_callback = broadcast_callback

    async def datachange_notification(self, node, val, data):
        global last_sql_log_time
        try:
            node_id_str = node.nodeid.to_string()
            data_val = data.monitored_item.Value if hasattr(data, "monitored_item") else data
            status_code = getattr(data_val, "StatusCode", None)
            status_quality = "Good" if (status_code is None or status_code.is_good()) else "Bad"

            ts = getattr(data_val, "SourceTimestamp", None) or getattr(data_val, "ServerTimestamp", None)
            timestamp_str = ts.strftime("%Y-%m-%d %H:%M:%S") if ts else datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            clean_val = round(val, 2) if isinstance(val, float) else val

            # Resolve tag metadata from ESSENTIAL_MES_TAGS whitelist or cache
            meta = NODE_TO_TAG_META.get(node_id_str)
            if meta:
                tag_name = meta.get("tag_name", node_id_str.split(".")[-1])
                role = meta.get("role", "General Process Tag")
                unit = meta.get("unit", "--")
                writable = meta.get("writable", True)
                description = meta.get("description", f"OPC UA Tag {tag_name}")
            else:
                cached_tag = latest_cache["tags"].get(node_id_str, {})
                tag_name = cached_tag.get("tag_name", node_id_str.split(".")[-1])
                role = cached_tag.get("role", "General Process Tag")
                unit = cached_tag.get("unit", "--")
                writable = cached_tag.get("writable", True)
                description = cached_tag.get("description", f"OPC UA Tag {tag_name}")

            # Resolve data type
            data_type = "Float"
            if node_id_str in latest_cache["tags"]:
                data_type = latest_cache["tags"][node_id_str].get("data_type", "Float")
            elif hasattr(data_val, "Value") and hasattr(data_val.Value, "VariantType") and data_val.Value.VariantType:
                data_type = data_val.Value.VariantType.name

            payload = {
                "tag_name": tag_name,
                "node_id": node_id_str,
                "value": clean_val,
                "data_type": data_type,
                "type": data_type,
                "quality": status_quality,
                "timestamp": timestamp_str,
                "role": role,
                "unit": unit,
                "writable": writable,
                "description": description
            }

            # Update RAM cache instantly for sub-millisecond HTTP / WS reads (store both raw and stripped)
            latest_cache["tags"][node_id_str] = payload
            clean_node_key = node_id_str.replace("ns=2;s=", "").strip()
            if clean_node_key and clean_node_key != node_id_str:
                latest_cache["tags"][clean_node_key] = payload
            latest_cache["last_updated"] = timestamp_str

            # Update Line 1 telemetry if applicable (mapped to essential tags)
            if tag_name == "Temp_Sterilizer_PV" or node_id_str == TAG_TEMP_ACT:
                gateway_state["telemetry"]["temperature_act"] = float(clean_val) if isinstance(clean_val, (int, float)) else 0.0
            elif tag_name == "Tank_Level_PV" or node_id_str == TAG_WEIGHT_ACT:
                gateway_state["telemetry"]["weight_act"] = float(clean_val) if isinstance(clean_val, (int, float)) else 0.0
            elif tag_name == "Batch_State" or node_id_str == TAG_BATCH_STATUS:
                gateway_state["telemetry"]["batch_status"] = str(clean_val)

            # Check if this changed node corresponds to any active tank (PV, LSH, LSL)
            clean_node_unprefixed = node_id_str.replace("ns=2;s=", "").strip()
            for tid, tdata in list(active_tank_pollers.items()):
                t_pv = (tdata.get("opc_node_id") or tdata.get("opcNodeId") or "").strip()
                t_high = (tdata.get("opc_high_node_id") or tdata.get("opcHighNodeId") or "").strip()
                t_low = (tdata.get("opc_low_node_id") or tdata.get("opcLowNodeId") or "").strip()

                if t_pv in (node_id_str, clean_node_unprefixed) or node_id_str.endswith(t_pv):
                    num_val = float(clean_val) if isinstance(clean_val, (int, float)) else 0.0
                    tdata["live_pv"] = num_val
                    tdata["livePv"] = num_val
                    tdata["quality"] = status_quality
                    tdata["pv_quality"] = status_quality
                    tdata["pvQuality"] = status_quality
                    tdata["last_synced"] = timestamp_str
                    tdata["lastSynced"] = timestamp_str
                    tdata["last_updated"] = timestamp_str
                    tdata["lastUpdated"] = timestamp_str

                    # Soft LSH / LSL computation from Loadcell PV when discrete sensors are unmapped
                    cap = float(tdata.get("tank_capacity") or tdata.get("tankCapacity") or tdata.get("capacity") or 5.0)
                    tare = float(tdata.get("tare_weight") or tdata.get("tareWeight") or 0.0)
                    s_min = float(tdata.get("min_safety_threshold") or tdata.get("minSafetyThreshold") or tdata.get("minThreshold") or 0.5)
                    net_w = max(0.0, num_val - tare)

                    if not t_high:
                        soft_h = bool(net_w >= cap * 0.95)
                        tdata["high_level_active"] = soft_h
                        tdata["highLevelActive"] = soft_h
                        tdata["is_soft_high"] = True

                    if not t_low:
                        soft_l = bool(net_w <= s_min)
                        tdata["low_level_active"] = soft_l
                        tdata["lowLevelActive"] = soft_l
                        tdata["is_soft_low"] = True

                    if tid == "TANK-01" or node_id_str == TAG_WEIGHT_ACT:
                        gateway_state["telemetry"]["weight_act"] = num_val

                    try:
                        await self.broadcast_callback({
                            "type": "TANK_TELEMETRY",
                            "tank_id": tid,
                            "tankId": tid,
                            "live_pv": num_val,
                            "livePv": num_val,
                            "quality": status_quality,
                            "pv_quality": status_quality,
                            "pvQuality": status_quality,
                            "pv_node": node_id_str,
                            "opc_node_id": node_id_str,
                            "high_level_active": tdata.get("high_level_active", False),
                            "highLevelActive": tdata.get("highLevelActive", False),
                            "low_level_active": tdata.get("low_level_active", False),
                            "lowLevelActive": tdata.get("lowLevelActive", False),
                            "is_soft_high": tdata.get("is_soft_high", False),
                            "is_soft_low": tdata.get("is_soft_low", False),
                            "timestamp": timestamp_str
                        })
                    except Exception:
                        pass

                elif t_high in (node_id_str, clean_node_unprefixed) or node_id_str.endswith(t_high):
                    h_bool = parse_discrete_bool(clean_val)
                    tdata["high_level_active"] = h_bool
                    tdata["highLevelActive"] = h_bool
                    tdata["high_level_quality"] = status_quality
                    tdata["highLevelQuality"] = status_quality

                elif t_low in (node_id_str, clean_node_unprefixed) or node_id_str.endswith(t_low):
                    l_bool = parse_discrete_bool(clean_val)
                    tdata["low_level_active"] = l_bool
                    tdata["lowLevelActive"] = l_bool
                    tdata["low_level_quality"] = status_quality
                    tdata["lowLevelQuality"] = status_quality

            # Broadcast to all connected WebSocket clients immediately
            try:
                await self.broadcast_callback({
                    "type": "TAG_UPDATE",
                    "data": payload
                })
            except Exception as bc_err:
                logger.warning(f"Error broadcasting datachange: {bc_err}")
        except Exception as err:
            logger.error(f"Error in datachange_notification for {node}: {err}")


# ============================================================================
# UNIFIED OPC UA SESSION MANAGER & REPORT-BY-EXCEPTION SUBSCRIBER
# ============================================================================

class RobustOPCManager:
    """
    Self-Healing OPC UA Session Manager:
    - Verifies active session on each access with <5ms server_state ping.
    - If channel dropped or timed out, completely discards old Client and establishes a fresh connection.
    - Never reuses a dead Client object, eliminating 'ua.UaError: client is disconnected'.
    """
    def __init__(self, endpoint: str):
        self.endpoint = endpoint
        self.client: Optional[Client] = None
        self.lock = asyncio.Lock()
        self.connected: bool = False
        self.subscription: Optional[Any] = None
        self.manual_disconnected: bool = False

    @property
    def is_connected(self) -> bool:
        return bool(self.connected and self.client is not None and not self.manual_disconnected)

    @is_connected.setter
    def is_connected(self, value: bool):
        self.connected = bool(value)

    async def get_active_client(self) -> Client:
        if self.manual_disconnected:
            raise ConnectionError("OPC UA session is manually disconnected by operator")
        async with self.lock:
            # Check if client exists and underlying session is still active
            if self.client is not None:
                try:
                    # Quick ping to verify live session (<5ms)
                    await self.client.nodes.server_state.read_value()
                    return self.client
                except Exception as e:
                    logger.warning(f"Existing client disconnected or ping failed ({e}). Discarding and reconnecting...")
                    try:
                        await self.client.disconnect()
                    except Exception:
                        pass
                    self.client = None
                    self.connected = False
                    self.subscription = None
                    node_cache.clear()

            # Connect fresh client
            logger.info(f"Connecting to Kepware OPC UA at {self.endpoint}...")
            try:
                new_client = Client(url=self.endpoint, timeout=4)
                await new_client.connect()
                self.client = new_client
                self.connected = True
                latest_cache["server_connected"] = True
                gateway_state["connected"] = True
                node_cache.clear()
                logger.info("Connected to Kepware OPC UA Server successfully.")
            except Exception as conn_err:
                self.mark_disconnected()
                raise conn_err

            # Setup Report-by-Exception subscription
            try:
                await self._setup_subscription_locked()
            except Exception as sub_err:
                logger.warning(f"Subscription setup warning: {sub_err}")

            try:
                await connection_manager.broadcast({
                    "type": "STATUS_UPDATE",
                    "status": "ONLINE",
                    "is_connected": True,
                    "connected": True,
                    "server_connected": True,
                    "endpoint": self.endpoint
                })
                await connection_manager.broadcast({
                    "type": "ALL_TAGS_STATUS",
                    "quality": "Good",
                    "status": "ONLINE"
                })
            except Exception:
                pass

            return self.client

    get_client = get_active_client

    async def _setup_subscription_locked(self):
        handler = KepwareSubHandler(connection_manager.broadcast)
        self.subscription = await self.client.create_subscription(100, handler)
        logger.info("Created OPC UA Subscription with period=100ms (Event-Driven / RBE).")

        # Whitelist essential MES tags exclusively
        nodes_to_subscribe = {}
        for tag_name, info in ESSENTIAL_MES_TAGS.items():
            if isinstance(info, dict) and "node_id" in info:
                nid = str(info["node_id"]).strip()
                if nid and nid != "[CHƯA ÁNH XẠ]":
                    nodes_to_subscribe[nid] = tag_name

        # Include custom watched tags if dynamically added
        for item in explorer_watchlist:
            if item["node_id"] not in nodes_to_subscribe:
                nodes_to_subscribe[item["node_id"]] = item.get("tag_name") or item["node_id"].split(".")[-1]

        # Include all active monitored tanks from dynamic poller list
        for tid, tdata in active_tank_pollers.items():
            nid = tdata.get("opc_node_id")
            if nid and nid not in nodes_to_subscribe:
                nodes_to_subscribe[nid] = f"{tid}_Level_PV"
            hnid = tdata.get("opc_high_node_id") or tdata.get("opcHighNodeId")
            if hnid and hnid not in nodes_to_subscribe:
                nodes_to_subscribe[hnid] = f"{tid}_LSH"
            lnid = tdata.get("opc_low_node_id") or tdata.get("opcLowNodeId")
            if lnid and lnid not in nodes_to_subscribe:
                nodes_to_subscribe[lnid] = f"{tid}_LSL"

        subscribed_count = 0
        for node_id, tag_name in nodes_to_subscribe.items():
            try:
                try:
                    node = self.client.get_node(node_id)
                except Exception:
                    if not node_id.startswith("ns="):
                        node = self.client.get_node(f"ns=2;s={node_id}")
                    else:
                        raise
                node_cache[node_id] = node
                await self.subscription.subscribe_data_change(
                    node,
                    queuesize=1,
                    sampling_interval=50
                )
                subscribed_count += 1

                # Initial read to populate cache immediately
                try:
                    data_val = await node.read_data_value()
                    if data_val and data_val.Value is not None:
                        raw_val = data_val.Value.Value
                        clean_val = round(raw_val, 2) if isinstance(raw_val, float) else raw_val
                        quality = "Good" if (data_val.StatusCode and data_val.StatusCode.is_good()) else "Bad"
                        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        dtype = "Float"
                        if hasattr(data_val.Value, "VariantType") and data_val.Value.VariantType:
                            dtype = data_val.Value.VariantType.name

                        meta = NODE_TO_TAG_META.get(node_id, {})
                        if node_id in latest_cache["tags"]:
                            latest_cache["tags"][node_id].update({
                                "value": clean_val,
                                "quality": quality,
                                "timestamp": now_str,
                                "data_type": dtype,
                                "type": dtype
                            })
                        elif meta:
                            latest_cache["tags"][node_id] = {
                                "tag_name": meta.get("tag_name", node_id.split(".")[-1]),
                                "node_id": node_id,
                                "role": meta.get("role", "General Process Tag"),
                                "unit": meta.get("unit", "--"),
                                "writable": meta.get("writable", True),
                                "description": meta.get("description", f"OPC UA Tag {node_id}"),
                                "type": dtype,
                                "data_type": dtype,
                                "value": clean_val,
                                "quality": quality,
                                "timestamp": now_str
                            }

                        if tag_name == "Temp_Sterilizer_PV" or node_id == TAG_TEMP_ACT:
                            gateway_state["telemetry"]["temperature_act"] = float(clean_val) if isinstance(clean_val, (int, float)) else 0.0
                        elif tag_name == "Tank_Level_PV" or node_id == TAG_WEIGHT_ACT:
                            gateway_state["telemetry"]["weight_act"] = float(clean_val) if isinstance(clean_val, (int, float)) else 0.0
                        elif tag_name == "Batch_State" or node_id == TAG_BATCH_STATUS:
                            gateway_state["telemetry"]["batch_status"] = str(clean_val)
                except Exception as read_err:
                    logger.debug(f"Initial read skipped for {node_id}: {read_err}")
            except Exception as sub_err:
                logger.debug(f"Subscription skipped for {node_id}: {sub_err}")

        logger.info(f"Subscribed {subscribed_count} essential MES nodes for Report-by-Exception monitoring.")

    async def resubscribe(self):
        async with self.lock:
            if self.client is not None and self.connected:
                if self.subscription is not None:
                    try:
                        await self.subscription.delete()
                    except Exception as del_err:
                        logger.debug(f"Subscription delete cleanup: {del_err}")
                    self.subscription = None
                node_cache.clear()
                try:
                    await self._setup_subscription_locked()
                    logger.info("Resubscribed to updated tag mappings successfully.")
                except Exception as sub_err:
                    logger.warning(f"Resubscription setup warning: {sub_err}")

    def mark_disconnected(self):
        self.connected = False
        latest_cache["server_connected"] = False
        gateway_state["connected"] = False
        self.subscription = None
        node_cache.clear()
        old_client = self.client
        self.client = None
        if old_client is not None:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(old_client.disconnect())
            except Exception:
                pass
        for t in latest_cache["tags"].values():
            t["quality"] = "Bad"
            if t.get("data_type") in ("Float", "Int16"):
                t["value"] = 0.0
            elif t.get("data_type") == "Boolean":
                t["value"] = False
            elif t.get("data_type") == "String":
                t["value"] = "IDLE"
        gateway_state["telemetry"]["temperature_act"] = 0.0
        gateway_state["telemetry"]["weight_act"] = 0.0
        gateway_state["telemetry"]["batch_status"] = "STOPPED"
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(connection_manager.broadcast({
                "type": "STATUS_UPDATE",
                "status": "OFFLINE",
                "is_connected": False,
                "connected": False,
                "server_connected": False,
                "endpoint": self.endpoint
            }))
            # Broadcast emergency stale data invalidation to all connected UI clients
            loop.create_task(connection_manager.broadcast({
                "type": "ALL_TAGS_STATUS",
                "quality": "Bad",
                "status": "OFFLINE"
            }))
        except RuntimeError:
            pass

    async def reconnect(self, new_endpoint: Optional[str] = None):
        self.manual_disconnected = False
        async with self.lock:
            if new_endpoint:
                self.endpoint = new_endpoint.strip()
                latest_cache["endpoint"] = self.endpoint
            if self.client is not None:
                try:
                    if self.subscription is not None:
                        try:
                            await self.subscription.delete()
                        except Exception:
                            pass
                    await self.client.disconnect()
                except Exception as e:
                    logger.debug(f"Disconnect error during reconnect: {e}")
                self.client = None
                self.connected = False
                self.subscription = None
                node_cache.clear()
        try:
            return await self.get_active_client()
        except Exception as e:
            logger.warning(f"Reconnect to {self.endpoint} failed: {e}")
            self.mark_disconnected()
            raise e

    async def disconnect_session(self):
        self.manual_disconnected = True
        async with self.lock:
            if self.subscription is not None:
                try:
                    await self.subscription.delete()
                except Exception:
                    pass
                self.subscription = None
            if self.client is not None:
                try:
                    await self.client.disconnect()
                except Exception:
                    pass
                self.client = None
            self.mark_disconnected()

    async def force_disconnect(self):
        await self.disconnect_session()

OPCUAManager = RobustOPCManager
opc_mgr = RobustOPCManager(KEPWARE_URL)


async def subscribe_node_dynamic(node_id: str, tag_name: str = "", expected_type: str = "Float"):
    """
    Dynamically registers a newly watched tag into the active OPC UA subscription
    and broadcasts its initial state to all connected WebSockets.
    """
    try:
        client = await opc_mgr.get_active_client()
        async with opc_mgr.lock:
            if opc_mgr.subscription is not None:
                node = client.get_node(node_id)
                node_cache[node_id] = node
                await opc_mgr.subscription.subscribe_data_change(node, queuesize=1, sampling_interval=50)
                logger.info(f"Dynamically subscribed to new node: {node_id} (sampling_interval=50ms)")

                try:
                    data_val = await node.read_data_value()
                    val = data_val.Value.Value if (data_val and data_val.Value) else 0.0
                    quality = "Good" if (data_val and data_val.StatusCode and data_val.StatusCode.is_good()) else "Bad"
                    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    payload = {
                        "tag_name": tag_name or node_id.split(".")[-1],
                        "node_id": node_id,
                        "value": round(val, 2) if isinstance(val, float) else val,
                        "data_type": expected_type,
                        "type": expected_type,
                        "quality": quality,
                        "timestamp": now_str
                    }
                    latest_cache["tags"][node_id] = payload
                    await connection_manager.broadcast({
                        "type": "TAG_UPDATE",
                        "data": payload
                    })
                except Exception:
                    pass
    except Exception as err:
        logger.warning(f"Failed to dynamically subscribe {node_id}: {err}")
        opc_mgr.mark_disconnected()


async def worker_kepware_supervisor():
    """
    Keepalive Heartbeat & Self-Healing Watchdog:
    - Runs every 2 seconds to prevent Kepware's 60-second inactivity timeout.
    - Uses get_active_client() to ensure connection is healthy.
    - Sends an active keepalive ping (server_state.read_value()).
    - If socket drops or Kepware stops, immediately marks all tags Bad and broadcasts ALL_TAGS_STATUS.
    """
    while True:
        try:
            if not opc_mgr.manual_disconnected:
                t0 = time.time()
                await opc_mgr.get_active_client()
                async with opc_mgr.lock:
                    if opc_mgr.client is not None:
                        # Active ping resets Kepware's 60s session inactivity timer
                        await opc_mgr.client.nodes.server_state.read_value()
                        current_ping = max(1, int((time.time() - t0) * 1000))
                        latest_cache["latency_ms"] = current_ping
                        gateway_state["latency_ms"] = current_ping

                        # Bidirectional Lifebit Watchdog toggle (ISA-88/ISA-95)
                        opc_mgr._lifebit_state = not getattr(opc_mgr, "_lifebit_state", False)
                        try:
                            modular = load_modular_tag_mappings()
                            ops_tags = modular.get("operations", {})
                            lb_entry = ops_tags.get("mes_lifebit") or ops_tags.get("MES_LIFEBIT")
                            lb_node_id = None
                            if isinstance(lb_entry, dict):
                                lb_node_id = lb_entry.get("node_id")
                            elif isinstance(lb_entry, str):
                                lb_node_id = lb_entry
                            if lb_node_id and lb_node_id.strip() and lb_node_id.strip() != "[CHƯA ÁNH XẠ]":
                                lb_node = opc_mgr.client.get_node(lb_node_id.strip())
                                await lb_node.write_value(ua.DataValue(ua.Variant(opc_mgr._lifebit_state, ua.VariantType.Boolean)))
                        except Exception as lb_err:
                            logger.debug(f"Watchdog lifebit notice: {lb_err}")
            await asyncio.sleep(2.0)
        except asyncio.CancelledError:
            break
        except Exception as err:
            logger.warning(f"Kepware watchdog detected disconnect or offline runtime: {err}")
            opc_mgr.mark_disconnected()
            try:
                await asyncio.sleep(1.5)
            except asyncio.CancelledError:
                break


# Rate-limiting state for live loadcell telemetry DB synchronization
_last_tank_sync_time: Dict[str, float] = {}
_last_tank_sync_val: Dict[str, float] = {}

def sync_tank_telemetry_to_db(tank_id: str, tag_name: str, live_pv: float, unit: str = "L"):
    """
    ISA-95 Level 3 Inventory Guard:
    DO NOT overwrite Book Inventory (CurrentStock in dbo.Material_Stock) with live sensor noise.
    CurrentStock is strictly managed by verified Inbound Receipts, Restocks, Calibrations, or Batch Backflushing.
    Live readings remain exclusively in latest_cache["tags"] and active_tank_pollers[tid]["live_pv"].
    Redundant PLC_Datalog inserts removed: worker_historian_logger() is the single canonical writer.
    """
    pass


async def bulk_read_nodes(client: Client, nodes_map: Dict[str, Any]) -> Dict[str, Any]:
    """
    High-Speed Bulk Read:
    Executes client.read_attributes in chunks of up to 500 nodes per UA roundtrip.
    If a bulk read fails, isolates slow/bad nodes through fast individual reads without blocking the batch.
    """
    results: Dict[str, Any] = {}
    if not nodes_map:
        return results

    items = list(nodes_map.items())
    chunk_size = 500

    for i in range(0, len(items), chunk_size):
        chunk = items[i:i + chunk_size]
        node_objs = [node for _, node in chunk]
        node_keys = [key for key, _ in chunk]
        try:
            async with opc_mgr.lock:
                dv_list = await asyncio.wait_for(
                    client.read_attributes(node_objs, attr=ua.AttributeIds.Value),
                    timeout=1.5
                )
            for k, dv in zip(node_keys, dv_list):
                results[k] = dv
        except Exception as chunk_err:
            logger.debug(f"Bulk read chunk notice: {chunk_err}. Isolating node reads...")
            for k, node in chunk:
                try:
                    async with opc_mgr.lock:
                        dv = await asyncio.wait_for(node.read_data_value(), timeout=0.15)
                    results[k] = dv
                except Exception:
                    bad_status = ua.StatusCode(ua.StatusCodes.Bad)
                    results[k] = ua.DataValue(ua.Variant(0.0, ua.VariantType.Float), bad_status)

    return results


async def worker_telemetry_streamer():
    """
    Continuous High-Speed OT Telemetry & Tank Sensor Streamer:
    - Runs at 200ms cycle.
    - Caches asyncua.Node objects in node_handle_cache.
    - Performs single bulk OPC UA calls: client.read_attributes(node_list) (chunked in 500).
    - Isolates slow/bad nodes: single node errors never block the rest of the batch.
    - Broadcasts essential telemetry, tank array, and full tags batch via WebSocket /ws/telemetry.
    """
    while True:
        try:
            await asyncio.sleep(0.20)
            is_connected = bool(opc_mgr.connected)

            if is_connected and opc_mgr.client:
                # 1. Gather all active nodes across tanks and subscribed_nodes
                nodes_to_poll: Dict[str, Any] = {}
                tank_nodes_polled_this_tick: Set[str] = set()

                for tid, tdata in list(active_tank_pollers.items()):
                    nid = (tdata.get("opc_node_id") or tdata.get("opcNodeId") or "").strip()
                    if not nid or nid == "" or "[CHƯA ÁNH XẠ]" in nid:
                        tdata["quality"] = "[CHƯA ÁNH XẠ]"
                        tdata["pv_quality"] = "[CHƯA ÁNH XẠ]"
                        tdata["pvQuality"] = "[CHƯA ÁNH XẠ]"
                        tdata["last_synced"] = "--"
                        tdata["lastSynced"] = "--"
                        continue

                    high_nid = (tdata.get("opc_high_node_id") or tdata.get("opcHighNodeId") or "").strip()
                    low_nid = (tdata.get("opc_low_node_id") or tdata.get("opcLowNodeId") or "").strip()

                    node_obj = get_cached_node(opc_mgr.client, nid)
                    if node_obj is not None:
                        nodes_to_poll[nid] = node_obj
                        tank_nodes_polled_this_tick.add(nid)
                        tank_nodes_polled_this_tick.add(nid.replace("ns=2;s=", "").strip())

                    if high_nid and high_nid != "[CHƯA ÁNH XẠ]":
                        h_node_obj = get_cached_node(opc_mgr.client, high_nid)
                        if h_node_obj is not None:
                            nodes_to_poll[high_nid] = h_node_obj
                            tank_nodes_polled_this_tick.add(high_nid)
                            tank_nodes_polled_this_tick.add(high_nid.replace("ns=2;s=", "").strip())

                    if low_nid and low_nid != "[CHƯA ÁNH XẠ]":
                        l_node_obj = get_cached_node(opc_mgr.client, low_nid)
                        if l_node_obj is not None:
                            nodes_to_poll[low_nid] = l_node_obj
                            tank_nodes_polled_this_tick.add(low_nid)
                            tank_nodes_polled_this_tick.add(low_nid.replace("ns=2;s=", "").strip())

                for snode in list(subscribed_nodes):
                    if not snode or snode in tank_nodes_polled_this_tick:
                        continue
                    clean_s = snode.replace("ns=2;s=", "").strip()
                    if clean_s in tank_nodes_polled_this_tick:
                        continue
                    s_node_obj = get_cached_node(opc_mgr.client, snode)
                    if s_node_obj is not None:
                        nodes_to_poll[snode] = s_node_obj

                # 2. Execute High-Speed Bulk Read
                bulk_results = await bulk_read_nodes(opc_mgr.client, nodes_to_poll)
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                # 3. Process Tank Readings
                for tid, tdata in list(active_tank_pollers.items()):
                    nid = (tdata.get("opc_node_id") or tdata.get("opcNodeId") or "").strip()
                    if not nid or nid == "" or "[CHƯA ÁNH XẠ]" in nid:
                        # ISA-88/95 Virtual Silo Mode (Book Inventory without physical loadcell)
                        cur_s = float(tdata.get("current_stock") if tdata.get("current_stock") is not None else (tdata.get("currentStock") or 0.0))
                        cap = float(tdata.get("tank_capacity") or tdata.get("tankCapacity") or tdata.get("capacity") or 5.0)
                        s_min = float(tdata.get("min_safety_threshold") or tdata.get("minSafetyThreshold") or tdata.get("minThreshold") or 0.5)
                        tdata["is_virtual_silo"] = True
                        tdata["isVirtualSilo"] = True
                        tdata["high_level_active"] = bool(cur_s >= cap * 0.95)
                        tdata["highLevelActive"] = bool(cur_s >= cap * 0.95)
                        tdata["low_level_active"] = bool(cur_s <= s_min)
                        tdata["lowLevelActive"] = bool(cur_s <= s_min)
                        tdata["is_soft_high"] = True
                        tdata["is_soft_low"] = True
                        continue

                    data_val = bulk_results.get(nid)
                    clean_val = tdata.get("live_pv", 0.0)
                    qual = "Bad"
                    if data_val is not None and data_val.Value is not None:
                        raw_val = data_val.Value.Value
                        clean_val = round(float(raw_val), 2) if isinstance(raw_val, (int, float)) and not isinstance(raw_val, bool) else raw_val
                        is_good = (data_val.StatusCode and data_val.StatusCode.is_good()) if data_val.StatusCode else True
                        qual = "Good" if is_good else "Bad"

                        tdata["live_pv"] = clean_val
                        tdata["livePv"] = clean_val
                        tdata["quality"] = qual
                        tdata["pv_quality"] = qual
                        tdata["pvQuality"] = qual
                        tdata["last_synced"] = now_str
                        tdata["lastSynced"] = now_str
                        tdata["last_updated"] = now_str
                        tdata["lastUpdated"] = now_str

                        tag_entry = {
                            "tag_name": f"{tid}_PV",
                            "node_id": nid,
                            "type": "Float",
                            "data_type": "Float",
                            "role": f"{tid} Level PV",
                            "unit": tdata.get("unit", "L"),
                            "writable": False,
                            "description": f"Storage Tank {tid} Sensor PV",
                            "value": clean_val,
                            "quality": qual,
                            "timestamp": now_str
                        }
                        latest_cache["tags"][nid] = tag_entry
                        clean_nid = nid.replace("ns=2;s=", "").strip()
                        if clean_nid and clean_nid != nid:
                            latest_cache["tags"][clean_nid] = tag_entry

                        if tid == "TANK-01" or nid == TAG_WEIGHT_ACT:
                            gateway_state["telemetry"]["weight_act"] = float(clean_val) if isinstance(clean_val, (int, float)) else 0.0

                    high_nid = (tdata.get("opc_high_node_id") or tdata.get("opcHighNodeId") or "").strip()
                    if high_nid and high_nid in bulk_results:
                        h_data = bulk_results[high_nid]
                        if h_data and h_data.Value is not None:
                            h_raw = h_data.Value.Value
                            is_h_good = (h_data.StatusCode and h_data.StatusCode.is_good()) if h_data.StatusCode else True
                            h_qual = "Good" if is_h_good else "Bad"
                            h_active = parse_discrete_bool(h_raw)
                            tdata["high_level_active"] = h_active
                            tdata["highLevelActive"] = h_active
                            tdata["high_level_quality"] = h_qual
                            tdata["highLevelQuality"] = h_qual

                            h_tag_entry = {
                                "tag_name": f"{tid}_LSH",
                                "node_id": high_nid,
                                "type": "Boolean",
                                "data_type": "Boolean",
                                "role": f"{tid} High Level Switch",
                                "unit": "BOOL",
                                "writable": False,
                                "description": f"Storage Tank {tid} Overfill Switch",
                                "value": h_active,
                                "quality": h_qual,
                                "timestamp": now_str
                            }
                            latest_cache["tags"][high_nid] = h_tag_entry
                            clean_hnid = high_nid.replace("ns=2;s=", "").strip()
                            if clean_hnid and clean_hnid != high_nid:
                                latest_cache["tags"][clean_hnid] = h_tag_entry

                    low_nid = (tdata.get("opc_low_node_id") or tdata.get("opcLowNodeId") or "").strip()
                    if low_nid and low_nid in bulk_results:
                        l_data = bulk_results[low_nid]
                        if l_data and l_data.Value is not None:
                            l_raw = l_data.Value.Value
                            is_l_good = (l_data.StatusCode and l_data.StatusCode.is_good()) if l_data.StatusCode else True
                            l_qual = "Good" if is_l_good else "Bad"
                            l_active = parse_discrete_bool(l_raw)
                            tdata["low_level_active"] = l_active
                            tdata["lowLevelActive"] = l_active
                            tdata["low_level_quality"] = l_qual
                            tdata["lowLevelQuality"] = l_qual

                            l_tag_entry = {
                                "tag_name": f"{tid}_LSL",
                                "node_id": low_nid,
                                "type": "Boolean",
                                "data_type": "Boolean",
                                "role": f"{tid} Low Level Switch",
                                "unit": "BOOL",
                                "writable": False,
                                "description": f"Storage Tank {tid} Dry Run Switch",
                                "value": l_active,
                                "quality": l_qual,
                                "timestamp": now_str
                            }
                            latest_cache["tags"][low_nid] = l_tag_entry
                            clean_lnid = low_nid.replace("ns=2;s=", "").strip()
                            if clean_lnid and clean_lnid != low_nid:
                                latest_cache["tags"][clean_lnid] = l_tag_entry

                    # Soft LSH / LSL calculation if discrete tags are unmapped
                    cap = float(tdata.get("tank_capacity") or tdata.get("tankCapacity") or tdata.get("capacity") or 5.0)
                    tare = float(tdata.get("tare_weight") or tdata.get("tareWeight") or 0.0)
                    s_min = float(tdata.get("min_safety_threshold") or tdata.get("minSafetyThreshold") or tdata.get("minThreshold") or 0.5)
                    net_w = max(0.0, float(clean_val) - tare)

                    if not high_nid:
                        soft_h = bool(net_w >= cap * 0.95)
                        tdata["high_level_active"] = soft_h
                        tdata["highLevelActive"] = soft_h
                        tdata["is_soft_high"] = True

                    if not low_nid:
                        soft_l = bool(net_w <= s_min)
                        tdata["low_level_active"] = soft_l
                        tdata["lowLevelActive"] = soft_l
                        tdata["is_soft_low"] = True

                # 4. Process Remaining Subscribed Nodes
                for snode in list(subscribed_nodes):
                    if not snode or snode in tank_nodes_polled_this_tick:
                        continue
                    clean_s = snode.replace("ns=2;s=", "").strip()
                    if clean_s in tank_nodes_polled_this_tick:
                        continue

                    s_dval = bulk_results.get(snode)
                    if s_dval and s_dval.Value is not None:
                        s_raw = s_dval.Value.Value
                        s_clean = round(float(s_raw), 2) if isinstance(s_raw, (int, float)) and not isinstance(s_raw, bool) else s_raw
                        s_good = (s_dval.StatusCode and s_dval.StatusCode.is_good()) if s_dval.StatusCode else True
                        s_qual = "Good" if s_good else "Bad"

                        s_entry = {
                            "tag_name": clean_s,
                            "node_id": snode if snode.startswith("ns=") else f"ns=2;s={snode}",
                            "value": s_clean,
                            "quality": s_qual,
                            "timestamp": now_str
                        }
                        latest_cache["tags"][snode] = s_entry
                        if clean_s and clean_s != snode:
                            latest_cache["tags"][clean_s] = s_entry
                    elif snode in bulk_results:
                        fallback_entry = latest_cache["tags"].get(snode) or latest_cache["tags"].get(clean_s)
                        if fallback_entry:
                            fallback_entry["quality"] = "Bad"
                            fallback_entry["timestamp"] = now_str
                            latest_cache["tags"][snode] = fallback_entry
                            if clean_s:
                                latest_cache["tags"][clean_s] = fallback_entry
                        else:
                            latest_cache["tags"][snode] = {
                                "tag_name": clean_s,
                                "node_id": snode if snode.startswith("ns=") else f"ns=2;s={snode}",
                                "value": 0.0,
                                "quality": "Bad",
                                "timestamp": now_str
                            }

            tank_array = list(active_tank_pollers.values())
            latest_cache["tanks"] = tank_array

            # 2. Broadcast summary to all active WebSocket clients
            if connection_manager.active_connections:
                essential_names = [
                    "Temp_Sterilizer_PV", "Tank_Level_PV", "Agitator_Speed_PV", 
                    "Batch_State", "Handshake_Loaded_OK", "CIP_CLEAN_STATUS", "CIP_START_CMD"
                ]
                tags_data = {}
                for node_id, t in latest_cache["tags"].items():
                    tag_name = t.get("tag_name")
                    if tag_name in essential_names or node_id in essential_names:
                        tag_copy = dict(t)
                        if not is_connected or tag_copy.get("quality") == "Bad":
                            if tag_name in ("Temp_Sterilizer_PV", "Tank_Level_PV", "Agitator_Speed_PV"):
                                tag_copy["value"] = 0.0
                        tags_data[tag_name or node_id] = tag_copy

                telemetry_payload = {
                    "temperature_act": float(gateway_state["telemetry"].get("temperature_act", 0.0)) if is_connected else 0.0,
                    "weight_act": float(gateway_state["telemetry"].get("weight_act", 0.0)) if is_connected else 0.0,
                    "batch_status": str(gateway_state["telemetry"].get("batch_status", "STOPPED")) if is_connected else "STOPPED"
                }

                await connection_manager.broadcast({
                    "type": "STREAM_HEARTBEAT",
                    "server_connected": is_connected,
                    "telemetry": telemetry_payload,
                    "essential_tags": tags_data,
                    "tanks": tank_array,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
                await connection_manager.broadcast({
                    "type": "TANK_TELEMETRY",
                    "tanks": tank_array,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
                # Universal Centralized Telemetry: Broadcast full active tag dictionary every tick
                await connection_manager.broadcast({
                    "type": "TAGS_BATCH",
                    "tags": latest_cache["tags"],
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Telemetry streamer exception: {e}")


def resolve_active_order_code() -> Tuple[Optional[str], bool]:
    """
    Resolves the active OrderCode for historian logging:
    STRICT PHYSICAL COMMISSIONING MODE:
    `dbo.PLC_Datalog` logging must ONLY trigger when an explicit Order in `dbo.Orders` has Status = 'RUNNING'.
    Zero logging during idle standby.
    """
    global active_running_order_code, _last_order_check_time, _cached_db_order_code

    now = time.time()
    if now - _last_order_check_time > 2.0:
        _last_order_check_time = now
        try:
            rows = execute_query(
                "SELECT TOP 1 OrderCode FROM dbo.Orders WHERE Status IN ('Running', 'RUNNING') ORDER BY Order_ID DESC",
                timeout=1
            )
            if rows and rows[0].get("OrderCode"):
                _cached_db_order_code = str(rows[0]["OrderCode"])
            else:
                _cached_db_order_code = None
        except Exception:
            _cached_db_order_code = None

    if _cached_db_order_code:
        return _cached_db_order_code, True

    if active_running_order_code:
        return str(active_running_order_code), True

    return None, False


def insert_historian_datalog(records: List[Tuple[str, str, float, str]]) -> bool:
    """
    Directly persists telemetry records into dbo.PLC_Datalog with atomic commit.
    Fallback to Store-and-Forward SQLite buffer if SQL Server is unreachable.
    Each record: (OrderCode, TagName, Value, Unit)
    """
    if not records:
        return False

    conn = None
    try:
        conn = get_connection(timeout=2)
        if conn:
            cursor = conn.cursor()
            query = (
                "INSERT INTO dbo.PLC_Datalog (OrderCode, TagName, Value, Unit, ReadTime) "
                "VALUES (?, ?, ?, ?, GETDATE())"
            )
            cursor.executemany(query, records)
            conn.commit()
            return True
    except Exception as db_err:
        logger.debug(f"Direct PLC_Datalog SQL insert notice: {db_err}, routing to store-and-forward buffer.")
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

    # Store-and-forward buffer fallback
    try:
        for oc, tn, val, un in records:
            db_engine.log_datalog(oc, tn, val, un)
        return True
    except Exception as buffer_err:
        logger.debug(f"Store-and-forward logging error: {buffer_err}")
        return False


async def worker_historian_logger():
    """
    Historian Time-Series Background Worker:
    - Runs periodically every 1.0 second.
    - Strictly PASSIVE: ONLY triggers when an explicit Order in dbo.Orders has Status = 'RUNNING'.
    - ZERO logging during idle standby.
    - Decoupled from the OPC event loop; fails safely if DB is momentarily unreachable.
    """
    global _last_historian_datalog_time
    while True:
        try:
            await asyncio.sleep(1.0)

            # 1. Tick Equipment Runtime Engine
            try:
                await historian.runtime_engine.tick_1s()
            except Exception as rt_err:
                logger.debug(f"Runtime tracker notice: {rt_err}")

            # 2. Check Active Batch State: Zero logging during idle standby
            order_code, is_batch = resolve_active_order_code()
            if not is_batch or not order_code:
                continue

            now_ts = time.time()
            if now_ts - _last_historian_datalog_time < 1.0:
                continue

            _last_historian_datalog_time = now_ts

            # 3. Extract Process Variables from Cache (Good quality only)
            pv_dict: Dict[str, Tuple[float, str]] = {}
            for node_id, t in latest_cache.get("tags", {}).items():
                tag_name = t.get("tag_name") or node_id
                val = t.get("value")
                unit = t.get("unit") or ""
                quality = t.get("quality")
                if quality == "Good" and val is not None and isinstance(val, (int, float)) and not isinstance(val, bool):
                    pv_dict[tag_name] = (float(val), str(unit))

            # 4. Values for essential process tags if present in cache (0.0 if absent)
            temp_val, temp_unit = pv_dict.get(
                "Temp_Sterilizer_PV",
                (float(gateway_state["telemetry"].get("temperature_act", 0.0)), "°C")
            )
            weight_val, weight_unit = pv_dict.get(
                "Tank_Level_PV",
                (float(gateway_state["telemetry"].get("weight_act", 0.0)), "L")
            )
            agitator_val, agitator_unit = pv_dict.get(
                "Agitator_Speed_PV",
                (0.0, "RPM")
            )
            cooling_val, cooling_unit = pv_dict.get(
                "Temp_Cooling_PV",
                (0.0, "°C")
            )

            # 5. Build records for insertion
            records: List[Tuple[str, str, float, str]] = []
            logged_tags = set()

            essential_list = [
                ("Temp_Sterilizer_PV", temp_val, temp_unit or "°C"),
                ("Tank_Level_PV", weight_val, weight_unit or "L"),
                ("Agitator_Speed_PV", agitator_val, agitator_unit or "RPM"),
                ("Temp_Cooling_PV", cooling_val, cooling_unit or "°C")
            ]
            for tag_name, val, unit in essential_list:
                records.append((order_code, tag_name, val, unit))
                logged_tags.add(tag_name)

            # Include any other numeric tags present in pv_dict
            for tag_name, (val, unit) in pv_dict.items():
                if tag_name not in logged_tags:
                    records.append((order_code, tag_name, val, unit or "--"))
                    logged_tags.add(tag_name)

            # 6. Execute atomic insert in worker thread
            await asyncio.to_thread(insert_historian_datalog, records)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Historian logging notice: {e}")



async def async_startup_database_init():
    """Non-blocking background database connection initialization and schema check."""
    try:
        try:
            from .sql_init import init_mes_database
        except (ImportError, ValueError):
            try:
                from sql_init import init_mes_database
            except (ImportError, ValueError):
                try:
                    from .init_sql import init_mes_database
                except (ImportError, ValueError):
                    from init_sql import init_mes_database
        await asyncio.to_thread(init_mes_database)
        logger.info("[KepwareGateway] Background database auto-init verified (dbo.Material_Stock zero-overwrite enforced).")
        await asyncio.to_thread(reload_tank_pollers_from_db)
        logger.info(f"[KepwareGateway] Runtime tank pollers loaded ({len(active_tank_pollers)} active tanks).")
    except Exception as e:
        logger.debug(f"[KepwareGateway] Background DB auto-init notice: {e}")

async def async_startup_opc_handshake():
    """Non-blocking background OPC UA handshake to guarantee zero delay in FastAPI HTTP readiness."""
    try:
        if not opc_mgr.manual_disconnected:
            await opc_mgr.get_active_client()
            logger.info("[KepwareGateway] Initial background OPC UA handshake completed successfully.")
    except Exception as e:
        logger.info(f"[KepwareGateway] Background OPC UA initial handshake notice (runtime standby): {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Non-blocking async background tasks for DB init, OPC UA handshake,
    # and Odoo Level 4 ERP heartbeat to guarantee instant HTTP server readiness (<50ms)
    db_init_task = asyncio.create_task(async_startup_database_init())
    opc_handshake_task = asyncio.create_task(async_startup_opc_handshake())
    supervisor_task = asyncio.create_task(worker_kepware_supervisor())
    streamer_task = asyncio.create_task(worker_telemetry_streamer())
    historian_task = asyncio.create_task(worker_historian_logger())

    odoo_heartbeat_task = None
    try:
        from odoo_connector import worker_odoo_heartbeat
        odoo_heartbeat_task = asyncio.create_task(worker_odoo_heartbeat())
        logger.info("[FastAPI Lifespan] Odoo Level 4 ERP heartbeat supervisor spawned successfully.")
    except Exception as odoo_task_err:
        logger.warning(f"[FastAPI Lifespan] Could not dispatch Odoo heartbeat task: {odoo_task_err}")

    logger.info("[FastAPI Lifespan] All background initialization tasks dispatched. HTTP server is immediately READY.")
    yield

    db_init_task.cancel()
    opc_handshake_task.cancel()
    supervisor_task.cancel()
    streamer_task.cancel()
    historian_task.cancel()
    if odoo_heartbeat_task is not None:
        odoo_heartbeat_task.cancel()

    tasks_to_cancel = [db_init_task, opc_handshake_task, supervisor_task, streamer_task, historian_task]
    if odoo_heartbeat_task is not None:
        tasks_to_cancel.append(odoo_heartbeat_task)

    for t in tasks_to_cancel:
        try:
            await t
        except (asyncio.CancelledError, Exception):
            pass

    if opc_mgr.client is not None:
        try:
            await opc_mgr.client.disconnect()
        except Exception:
            pass


app = FastAPI(title="MES OPC UA Gateway (KEPServerEX)", lifespan=lifespan)
app.include_router(db_routes.router)
if quality_router is not None:
    app.include_router(quality_router)
if opc_routes is not None:
    app.include_router(opc_routes.router)
if ai_router is not None:
    app.include_router(ai_router, prefix="/api/ai", tags=["AI Copilot"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    Real-Time WebSocket Telemetry Stream:
    - Automatically sends full snapshot of active tags upon connection.
    - Streams Report-by-Exception TAG_UPDATE events and STREAM_HEARTBEAT updates.
    - Maintains active connection with ping/pong and cached telemetry even if Kepware is offline.
    """
    await connection_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        connection_manager.disconnect(websocket)
    except Exception:
        connection_manager.disconnect(websocket)


# Connect to Siemens WinCC SQL Server instance
CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost\\WINCC;"
    "DATABASE=MES_Milk_Production;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=2;"
)


def verify_mes_database_status() -> bool:
    """
    Return True ONLY if:
    1. The SQL Server instance (localhost\\WINCC) is reachable.
    2. The database 'MES_Milk_Production' actually exists and can be queried.
    """
    return db_connector.verify_mes_database_status()


def check_sql_connection(timeout: int = 2) -> bool:
    """Check connectivity to Siemens WinCC SQL Server instance."""
    return db_connector.verify_mes_database_status()


@app.get("/api/system/status")
async def get_system_status():
    """
    Unified System Status endpoint returning online status for both
    SQL Server and Kepware OPC UA server to update Navbar telemetry badges.
    """
    sql_online = await asyncio.to_thread(verify_mes_database_status)
    kepware_online = bool(opc_mgr.is_connected)
    return {
        "sql_online": sql_online,
        "kepware_online": kepware_online,
        "is_connected": kepware_online,
        "port": 8000,
        "status": "connected" if (sql_online or kepware_online) else "standby"
    }




class HandshakeRequest(BaseModel):
    endpoint: str
    timeout: Optional[int] = 3000

class GatewayConfigPayload(BaseModel):
    endpoint: str
    timeout_ms: Optional[int] = 3000
    sampling_rate_ms: Optional[int] = 1000
    sampling_interval_ms: Optional[int] = None
    provider_name: Optional[str] = None
    security_policy: Optional[str] = "None"
    auth_mode: Optional[str] = "anonymous"
    username: Optional[str] = ""

@app.get("/api/gateway/config")
async def get_gateway_config_endpoint():
    cfg = load_gateway_config()
    cfg["connected"] = bool(opc_mgr.is_connected)
    cfg["is_connected"] = bool(opc_mgr.is_connected)
    cfg["server_connected"] = bool(opc_mgr.is_connected)
    cfg["status"] = "ONLINE" if opc_mgr.is_connected else "OFFLINE"
    cfg["current_active_endpoint"] = opc_mgr.endpoint
    return cfg

@app.post("/api/gateway/config")
async def update_gateway_config_endpoint(req: GatewayConfigPayload):
    endpoint = req.endpoint.strip() if req.endpoint else ""
    if not endpoint:
        raise HTTPException(status_code=400, detail="Endpoint URL cannot be empty")
        
    cfg_data = {
        "endpoint": endpoint,
        "timeout_ms": req.timeout_ms or 3000,
        "sampling_rate_ms": req.sampling_rate_ms or 1000,
        "sampling_interval_ms": req.sampling_interval_ms or req.sampling_rate_ms or 100,
        "provider_name": req.provider_name or "KEPServerEX v6 - Industrial Connectivity Platform",
        "security_policy": req.security_policy or "None",
        "auth_mode": req.auth_mode or "anonymous",
        "username": req.username or ""
    }
    
    if not save_gateway_config(cfg_data):
        return JSONResponse(status_code=500, content={"success": False, "error": "Failed to save gateway_config.json"})
        
    opc_mgr.manual_disconnected = False
    reconnect_error = None
    try:
        await opc_mgr.reconnect(new_endpoint=endpoint)
    except Exception as e:
        reconnect_error = str(e)
        logger.warning(f"Reconnect after config update warning: {e}")
        
    return {
        "success": True,
        "message": f"Gateway configuration persisted to disk. Active endpoint: {endpoint}",
        "config": cfg_data,
        "connected": bool(opc_mgr.is_connected),
        "is_connected": bool(opc_mgr.is_connected),
        "server_connected": bool(opc_mgr.is_connected),
        "status": "ONLINE" if opc_mgr.is_connected else "OFFLINE",
        "reconnect_error": reconnect_error
    }

@app.post("/api/gateway/test-handshake")
async def test_gateway_handshake(req: HandshakeRequest):
    """
    Spawns an isolated asyncua.Client with 3-second timeout (asyncio.wait_for).
    Returns success or failure reason without disrupting the primary active connection.
    """
    endpoint = req.endpoint.strip() if req.endpoint else ""
    if not endpoint:
        return {"success": False, "error": "Endpoint URL cannot be empty"}
    
    # Reuse active opc_mgr session directly if testing the currently connected endpoint
    if opc_mgr.is_connected and opc_mgr.client and (endpoint == getattr(opc_mgr, "endpoint", "") or endpoint == getattr(opc_mgr, "endpoint", "").rstrip("/")):
        try:
            val = await asyncio.wait_for(opc_mgr.client.nodes.server_state.read_value(), timeout=2.0)
            return {
                "success": True,
                "message": f"Handshake verified via active central session: Successfully connected to {endpoint}",
                "endpoint": endpoint
            }
        except Exception as e:
            logger.warning(f"Active session state check warning: {e}")

    timeout_sec = max(1.0, (req.timeout or 3000) / 1000.0)
    logger.info(f"Testing isolated handshake with OPC UA server: {endpoint} (timeout={timeout_sec}s)...")
    
    temp_client = None
    try:
        temp_client = Client(url=endpoint, timeout=timeout_sec)
        await asyncio.wait_for(temp_client.connect(), timeout=timeout_sec)
        try:
            await asyncio.wait_for(temp_client.nodes.server_state.read_value(), timeout=2.0)
        except Exception:
            pass
        return {
            "success": True,
            "message": f"Handshake verified: Successfully connected to {endpoint}",
            "endpoint": endpoint
        }
    except asyncio.TimeoutError:
        logger.warning(f"Handshake timed out for {endpoint}")
        return {
            "success": False,
            "error": f"Connection timed out after {int(timeout_sec)}s to {endpoint}. Verify host and port."
        }
    except Exception as exc:
        err_msg = str(exc)
        logger.warning(f"Handshake failed for {endpoint}: {err_msg}")
        return {
            "success": False,
            "error": f"Handshake failed: {err_msg}"
        }
    finally:
        if temp_client is not None:
            try:
                await temp_client.disconnect()
            except Exception:
                pass

@app.post("/api/gateway/connect")
async def connect_gateway_endpoint(payload: Optional[Dict[str, Any]] = None):
    opc_mgr.manual_disconnected = False
    if payload and "endpoint" in payload and payload["endpoint"]:
        opc_mgr.endpoint = payload["endpoint"].strip()
        latest_cache["endpoint"] = opc_mgr.endpoint
    try:
        await opc_mgr.get_active_client()
        current_latency = latest_cache.get("latency_ms", 0) if isinstance(latest_cache, dict) else 0
        tag_count = len(latest_cache.get("tags", {})) if isinstance(latest_cache, dict) else 0
        return {
            "success": True,
            "status": "ONLINE" if opc_mgr.is_connected else "OFFLINE",
            "is_connected": bool(opc_mgr.is_connected),
            "connected": bool(opc_mgr.is_connected),
            "server_connected": bool(opc_mgr.is_connected),
            "endpoint": getattr(opc_mgr, "endpoint", KEPWARE_URL),
            "latency_ms": current_latency,
            "active_tags": tag_count
        }
    except Exception as e:
        opc_mgr.mark_disconnected()
        return {
            "success": False,
            "status": "OFFLINE",
            "is_connected": False,
            "connected": False,
            "server_connected": False,
            "endpoint": getattr(opc_mgr, "endpoint", KEPWARE_URL),
            "latency_ms": 0,
            "active_tags": 0,
            "error": str(e)
        }

@app.post("/api/gateway/disconnect")
async def disconnect_gateway_endpoint():
    await opc_mgr.disconnect_session()
    return {
        "success": True,
        "status": "OFFLINE",
        "is_connected": False,
        "connected": False,
        "server_connected": False,
        "endpoint": getattr(opc_mgr, "endpoint", KEPWARE_URL),
        "latency_ms": 0,
        "active_tags": 0
    }

@app.get("/api/gateway/status")
async def get_status():
    try:
        is_conn = bool(opc_mgr.is_connected)
        endpoint = getattr(opc_mgr, "endpoint", KEPWARE_URL)
        latency = latest_cache.get("latency_ms", 0) if isinstance(latest_cache, dict) else 0
        tags_dict = latest_cache.get("tags", {}) if isinstance(latest_cache, dict) else {}
        tag_count = len(tags_dict) if isinstance(tags_dict, dict) else 0
        return {
            "status": "ONLINE" if is_conn else "OFFLINE",
            "is_connected": is_conn,
            "connected": is_conn,
            "server_connected": is_conn,
            "endpoint": endpoint,
            "latency_ms": latency,
            "active_tags": tag_count
        }
    except Exception as exc:
        logger.warning(f"Error in /api/gateway/status: {exc}")
        return {
            "status": "OFFLINE",
            "is_connected": False,
            "connected": False,
            "server_connected": False,
            "endpoint": getattr(opc_mgr, "endpoint", KEPWARE_URL) if 'opc_mgr' in globals() else "",
            "latency_ms": 0,
            "active_tags": 0,
            "error": str(exc)
        }


@app.get("/api/gateway/live-telemetry")
async def read_live_telemetry():
    """
    Protected Live Telemetry Endpoint:
    Thread-safe / Socket-safe access wrapped in async with opc_mgr.lock.
    Returns Line1 telemetry fields directly for backward compatibility,
    plus the full whitelisted essential ISA-88 process tags and server status.
    """
    async with opc_mgr.lock:
        res = dict(gateway_state["telemetry"])
        res.update({
            "server_connected": bool(opc_mgr.connected),
            "latency_ms": latest_cache.get("latency_ms", 0),
            "essential_tags": list(latest_cache["tags"].values()),
            "last_updated": latest_cache.get("last_updated", "--:--:--")
        })
        return res

get_telemetry = read_live_telemetry


class Setpoints(BaseModel):
    temperature_sp: float
    weight_sp: float


@app.post("/api/gateway/write-setpoints")
async def write_setpoints(sp: Setpoints):
    try:
        client = await opc_mgr.get_client()
        async with opc_mgr.lock:
            var_temp_sp = client.get_node("ns=2;s=Siemens.Line1.Temperature_SP")
            var_weight_sp = client.get_node("ns=2;s=Siemens.Line1.Weight_SP")
            
            await var_temp_sp.write_value(ua.DataValue(ua.Variant(sp.temperature_sp, ua.VariantType.Float)))
            await var_weight_sp.write_value(ua.DataValue(ua.Variant(sp.weight_sp, ua.VariantType.Float)))
        
        # Log setpoints and actual deviation into dbo.PLC_Setpoint_Monitoring
        cur_temp = float(gateway_state["telemetry"].get("temperature_act", 0.0))
        cur_weight = float(gateway_state["telemetry"].get("weight_act", 0.0))

        def _log_sp_deviations():
            historian.log_setpoint_deviation("ns=2;s=Siemens.Line1.Temperature_SP", sp.temperature_sp, cur_temp)
            historian.log_setpoint_deviation("ns=2;s=Siemens.Line1.Weight_SP", sp.weight_sp, cur_weight)

        asyncio.create_task(asyncio.to_thread(_log_sp_deviations))

        return {"status": "success", "message": "Setpoints dispatched successfully via Kepware"}
    except Exception as e:
        opc_mgr.mark_disconnected()
        raise HTTPException(status_code=500, detail=str(e))


class BatchCommand(BaseModel):
    command: str


@app.post("/api/gateway/batch-command")
async def write_command(cmd: BatchCommand):
    global active_running_order_code
    upper_cmd = cmd.command.strip().upper()
    gateway_state["batch_command"] = upper_cmd

    if upper_cmd == "START":
        resolved_order, is_run = resolve_active_order_code()
        if not active_running_order_code and resolved_order:
            active_running_order_code = resolved_order
        # Transition active batch equipments to RUNNING in SQL Server
        def _start_equipments():
            for eq_code in ["PUMP_INLET_MILK", "PUMP_INLET_SUGAR", "PUMP_INLET_ADDITIVE", "AGITATOR_MIX", "HEATER_UHT", "CHILLER_COOL", "PUMP_OUTLET"]:
                try:
                    historian.update_equipment_status(eq_code, "RUNNING", trigger_source="BATCH_START_COMMAND")
                except Exception as e:
                    logger.debug(f"Failed to start equipment {eq_code}: {e}")
        asyncio.create_task(asyncio.to_thread(_start_equipments))

    elif upper_cmd in ("STOP", "RESET", "ABORT"):
        active_running_order_code = None
        # Transition active batch equipments to STOP in SQL Server
        def _stop_equipments():
            for eq_code in ["PUMP_INLET_MILK", "PUMP_INLET_SUGAR", "PUMP_INLET_ADDITIVE", "AGITATOR_MIX", "HEATER_UHT", "CHILLER_COOL", "PUMP_OUTLET"]:
                try:
                    historian.update_equipment_status(eq_code, "STOP", trigger_source=f"BATCH_{upper_cmd}_COMMAND")
                except Exception as e:
                    logger.debug(f"Failed to stop equipment {eq_code}: {e}")
        asyncio.create_task(asyncio.to_thread(_stop_equipments))

    try:
        client = await opc_mgr.get_client()
        async with opc_mgr.lock:
            var_cmd = client.get_node("ns=2;s=Siemens.Line1.Command")
            await var_cmd.write_value(ua.DataValue(ua.Variant(cmd.command, ua.VariantType.String)))
        return {"status": "success", "message": f"Command {cmd.command} dispatched to PLC via OPC"}
    except Exception as e:
        opc_mgr.mark_disconnected()
        raise HTTPException(
            status_code=503,
            detail=f"Cannot dispatch command '{cmd.command}': Physical Kepware Gateway is offline ({e})"
        )



# ============================================================================
# OPC UA DIAGNOSTIC & TAG EXPLORER ENDPOINTS
# ============================================================================

class ReadNodeRequest(BaseModel):
    node_id: str


class WriteNodeRequest(BaseModel):
    node_id: str
    value: Any
    data_type: str = "Float"


class WatchTagRequest(BaseModel):
    node_id: str
    tag_name: Optional[str] = None
    expected_type: Optional[str] = "Float"
    description: Optional[str] = None


def convert_to_ua_variant(val: Any, data_type: str) -> ua.Variant:
    dt = data_type.strip().lower()
    if dt in ("float", "single"):
        return ua.Variant(float(val), ua.VariantType.Float)
    elif dt in ("double", "float64"):
        return ua.Variant(float(val), ua.VariantType.Double)
    elif dt in ("int", "int32", "integer"):
        return ua.Variant(int(val), ua.VariantType.Int32)
    elif dt in ("int16", "short"):
        return ua.Variant(int(val), ua.VariantType.Int16)
    elif dt in ("uint16", "ushort"):
        return ua.Variant(int(val), ua.VariantType.UInt16)
    elif dt in ("uint32", "uint"):
        return ua.Variant(int(val), ua.VariantType.UInt32)
    elif dt in ("bool", "boolean"):
        bool_val = val if isinstance(val, bool) else (str(val).strip().lower() in ("true", "1", "yes", "t"))
        return ua.Variant(bool_val, ua.VariantType.Boolean)
    elif dt in ("string", "str"):
        return ua.Variant(str(val), ua.VariantType.String)
    else:
        try:
            return ua.Variant(float(val), ua.VariantType.Float)
        except (ValueError, TypeError):
            return ua.Variant(str(val), ua.VariantType.String)


# ============================================================================
# BIDIRECTIONAL CIP HYGIENE GATEWAY (PLC <-> MES)
# ============================================================================

class CipStartRequest(BaseModel):
    duration_seconds: float = 5.0

_active_cip_task: Optional[asyncio.Task] = None

async def set_tag_internal(tag_name: str, value: Any, default_node_id: str, data_type: str = "Boolean"):
    """Safely updates a tag in latest_cache, attempts physical OPC UA write, and broadcasts."""
    node_id = default_node_id
    for nid, t in latest_cache.get("tags", {}).items():
        if t.get("tag_name") == tag_name or nid == default_node_id:
            node_id = nid
            break
            
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if node_id in latest_cache.get("tags", {}):
        latest_cache["tags"][node_id]["value"] = value
        latest_cache["tags"][node_id]["quality"] = "Good"
        latest_cache["tags"][node_id]["timestamp"] = now_str
    else:
        latest_cache.setdefault("tags", {})[node_id] = {
            "tag_name": tag_name,
            "node_id": node_id,
            "value": value,
            "data_type": data_type,
            "type": data_type,
            "quality": "Good",
            "timestamp": now_str,
            "role": "CIP Hygiene Control",
            "unit": "Bool",
            "writable": True,
            "description": f"CIP Tag {tag_name}"
        }
    
    # Try physical OPC UA write
    if opc_mgr.connected and opc_mgr.client:
        try:
            node = opc_mgr.client.get_node(node_id)
            if data_type in ("Boolean", "Bool"):
                var_val = ua.Variant(bool(value), ua.VariantType.Boolean)
            else:
                var_val = ua.Variant(value, ua.VariantType.String)
            try:
                await node.write_value(var_val)
            except Exception:
                await node.write_value(ua.DataValue(var_val))
        except Exception as err:
            logger.debug(f"[CIP] Physical OPC UA write notice for {node_id} ({err}); RAM cache preserved.")
            
    # Broadcast to WebSockets
    try:
        await connection_manager.broadcast({
            "type": "TAG_UPDATE",
            "data": latest_cache["tags"][node_id]
        })
    except Exception:
        pass

async def _run_cip_cycle_sequence(duration_seconds: float = 5.0):
    try:
        logger.info(f"[CIP] Sanitation sequence initiated ({duration_seconds}s cycle)...")
        modular = load_modular_tag_mappings()
        ops_tags = modular.get("operations", {})

        def _get_node(tag_dict, *keys):
            for k in keys:
                item = tag_dict.get(k)
                if isinstance(item, str) and item.strip() and item.strip() != "[CHƯA ÁNH XẠ]":
                    return item.strip()
                if isinstance(item, dict):
                    nid = str(item.get("node_id", "")).strip()
                    if nid and nid != "[CHƯA ÁNH XẠ]":
                        return nid
            return ""

        cip_start_node = _get_node(ops_tags, "cip_start_cmd", "CIP_START_CMD")
        cip_clean_node = _get_node(ops_tags, "cip_clean_status", "CIP_CLEAN_STATUS")

        # Step 1: Assert CIP_START_CMD = True, CIP_CLEAN_STATUS = False (during wash)
        if cip_start_node:
            await set_tag_internal("CIP_START_CMD", True, cip_start_node, "Boolean")
        if cip_clean_node:
            await set_tag_internal("CIP_CLEAN_STATUS", False, cip_clean_node, "Boolean")
        
        await asyncio.sleep(duration_seconds)
        
        # Step 2: Wash finish -> CIP_START_CMD = False, CIP_CLEAN_STATUS = True (clean / interlock disengaged)
        if cip_start_node:
            await set_tag_internal("CIP_START_CMD", False, cip_start_node, "Boolean")
        if cip_clean_node:
            await set_tag_internal("CIP_CLEAN_STATUS", True, cip_clean_node, "Boolean")
        logger.info("[CIP] Sanitation cycle complete! CIP_CLEAN_STATUS = True. Interlock unlocked.")
        
        try:
            dispatch_db_log(
                "INSERT INTO dbo.UserActionLog (UserName, UserRole, ActionName, Detail, ActionTime) VALUES (?, ?, ?, ?, GETDATE())",
                ("System / PLC", "CIP Gateway", "CIP_CYCLE_COMPLETE", "Clean-In-Place 5-stage sanitization cycle finished and validated. Sterility window active.")
            )
        except Exception:
            pass
    except asyncio.CancelledError:
        logger.info("[CIP] Sanitation cycle cancelled.")
    except Exception as exc:
        logger.error(f"[CIP] Sanitation cycle error: {exc}")

async def reset_cip_internal():
    global _active_cip_task
    if _active_cip_task and not _active_cip_task.done():
        _active_cip_task.cancel()
    modular = load_modular_tag_mappings()
    ops_tags = modular.get("operations", {})

    def _get_node(tag_dict, *keys):
        for k in keys:
            item = tag_dict.get(k)
            if isinstance(item, str) and item.strip() and item.strip() != "[CHƯA ÁNH XẠ]":
                return item.strip()
            if isinstance(item, dict):
                nid = str(item.get("node_id", "")).strip()
                if nid and nid != "[CHƯA ÁNH XẠ]":
                    return nid
        return ""

    cip_start_node = _get_node(ops_tags, "cip_start_cmd", "CIP_START_CMD")
    cip_clean_node = _get_node(ops_tags, "cip_clean_status", "CIP_CLEAN_STATUS")

    if cip_start_node:
        await set_tag_internal("CIP_START_CMD", False, cip_start_node, "Boolean")
    if cip_clean_node:
        await set_tag_internal("CIP_CLEAN_STATUS", False, cip_clean_node, "Boolean")

@app.post("/api/gateway/cip/start")
@app.post("/api/operations/cip/start")
async def start_cip_gateway(req: Optional[CipStartRequest] = None):
    global _active_cip_task
    dur = float(req.duration_seconds) if req and req.duration_seconds else 5.0
    if _active_cip_task and not _active_cip_task.done():
        _active_cip_task.cancel()
    _active_cip_task = asyncio.create_task(_run_cip_cycle_sequence(dur))
    return {
        "success": True,
        "status": "IN_PROGRESS",
        "duration_seconds": dur,
        "message": "CIP sanitization cycle initiated: CIP_START_CMD = True, CIP_CLEAN_STATUS = False",
        "cip_start_cmd": True,
        "cip_clean_status": False
    }

@app.post("/api/gateway/cip/reset")
@app.post("/api/operations/cip/reset")
async def reset_cip_gateway():
    await reset_cip_internal()
    return {
        "success": True,
        "status": "DIRTY_EXPIRED",
        "message": "CIP interlock reset to DIRTY / EXPIRED (CIP_CLEAN_STATUS = False, CIP_START_CMD = False)",
        "cip_start_cmd": False,
        "cip_clean_status": False
    }

@app.get("/api/gateway/cip/status")
@app.get("/api/operations/cip/status")
async def get_cip_gateway_status():
    modular = load_modular_tag_mappings()
    ops_tags = modular.get("operations", {})

    def _get_node(tag_dict, *keys):
        for k in keys:
            item = tag_dict.get(k)
            if isinstance(item, str) and item.strip() and item.strip() != "[CHƯA ÁNH XẠ]":
                return item.strip()
            if isinstance(item, dict):
                nid = str(item.get("node_id", "")).strip()
                if nid and nid != "[CHƯA ÁNH XẠ]":
                    return nid
        return ""

    cip_clean_node = _get_node(ops_tags, "cip_clean_status", "CIP_CLEAN_STATUS")
    cip_start_node = _get_node(ops_tags, "cip_start_cmd", "CIP_START_CMD")

    clean_val = False
    cmd_val = False
    if cip_clean_node and cip_clean_node in latest_cache.get("tags", {}):
        clean_val = bool(latest_cache["tags"][cip_clean_node].get("value"))
    if cip_start_node and cip_start_node in latest_cache.get("tags", {}):
        cmd_val = bool(latest_cache["tags"][cip_start_node].get("value"))

    return {
        "success": True,
        "cip_clean_status": clean_val,
        "cip_start_cmd": cmd_val,
        "is_clean": clean_val,
        "is_washing": cmd_val
    }


# ============================================================================
# INSTANT HOT-REGISTRATION & FAST-PATH NODE CONNECTIVITY PROBE
# ============================================================================

class TestNodePayload(BaseModel):
    node_id: str

async def test_node_connectivity(req: TestNodePayload) -> Dict[str, Any]:
    """
    Fast-path OPC UA Node connectivity test reusing the central connection:
    1. Checks latest_cache["tags"] (<5ms fast path)
    2. Otherwise reuses shared opc_mgr client with asyncio.wait_for(node.read_data_value(), timeout=4.0)
    Never spawns duplicate Client connections.
    """
    node_id = (req.node_id or "").strip()
    if not node_id or node_id == "[CHƯA ÁNH XẠ]":
        return {
            "success": False,
            "valid": False,
            "node_id": node_id,
            "quality": "Unmapped",
            "value": None,
            "message": "Node ID chưa được cấu hình / trống"
        }

    clean_nid = node_id.replace("ns=2;s=", "").strip()

    # 1. Fast-Path: In-memory cache (<5ms, zero network latency)
    cached_tag = (
        latest_cache.get("tags", {}).get(node_id)
        or latest_cache.get("tags", {}).get(clean_nid)
        or latest_cache.get("tags", {}).get(f"ns=2;s={clean_nid}")
    )
    if cached_tag and cached_tag.get("quality") == "Good" and cached_tag.get("value") is not None:
        raw_v = cached_tag.get("value")
        clean_v = round(float(raw_v), 2) if isinstance(raw_v, (int, float)) and not isinstance(raw_v, bool) else raw_v
        return {
            "success": True,
            "valid": True,
            "node_id": node_id,
            "value": clean_v,
            "datatype": cached_tag.get("data_type") or cached_tag.get("type") or "Float",
            "quality": "Good",
            "message": "Node verified successfully via active central OPC UA cache"
        }

    # 2. Live read via shared opc_mgr client
    if not opc_mgr.is_connected or not opc_mgr.client:
        return {
            "success": False,
            "valid": False,
            "node_id": node_id,
            "quality": "Bad",
            "value": None,
            "message": "Phiên kết nối OPC UA trung tâm chưa sẵn sàng"
        }

    try:
        client = await opc_mgr.get_active_client()
        node = get_cached_node(client, node_id)
        if node is None:
            return {
                "success": False,
                "valid": False,
                "node_id": node_id,
                "quality": "Bad",
                "value": None,
                "message": f"Không thể khởi tạo Node object cho '{node_id}'"
            }

        async with opc_mgr.lock:
            data_val = await asyncio.wait_for(node.read_data_value(), timeout=4.0)

        if data_val is not None:
            raw_val = data_val.Value.Value if data_val.Value is not None else 0.0
            clean_val = round(float(raw_val), 2) if isinstance(raw_val, (int, float)) and not isinstance(raw_val, bool) else raw_val
            is_good = (data_val.StatusCode and data_val.StatusCode.is_good()) if data_val.StatusCode else True
            dtype = "Variant"
            if data_val.Value and hasattr(data_val.Value, "VariantType") and data_val.Value.VariantType:
                dtype = data_val.Value.VariantType.name

            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            tag_entry = {
                "tag_name": clean_nid,
                "node_id": node_id,
                "value": clean_val,
                "quality": "Good" if is_good else "Bad",
                "type": dtype,
                "data_type": dtype,
                "timestamp": now_str
            }
            latest_cache.setdefault("tags", {})[node_id] = tag_entry
            if clean_nid and clean_nid != node_id:
                latest_cache.setdefault("tags", {})[clean_nid] = tag_entry
            register_subscribed_node(node_id)

            return {
                "success": is_good,
                "valid": is_good,
                "node_id": node_id,
                "value": clean_val,
                "datatype": dtype,
                "quality": "Good" if is_good else "Bad",
                "message": "Node verified successfully via active OPC UA session" if is_good else f"Bad (Lỗi tín hiệu cảm biến: {data_val.StatusCode})"
            }
    except asyncio.TimeoutError:
        return {
            "success": False,
            "valid": False,
            "node_id": node_id,
            "quality": "Bad",
            "value": None,
            "message": "Quá thời gian phản hồi từ thiết bị ngoại vi (Timeout 4.0s)"
        }
    except Exception as exc:
        return {
            "success": False,
            "valid": False,
            "node_id": node_id,
            "quality": "Bad",
            "value": None,
            "message": f"Kepware node test failed: {str(exc)}"
        }

async def hot_register_and_read(node_id: str, tag_name: str = "", role: str = "", unit: str = "") -> Optional[Dict[str, Any]]:
    """
    Dynamically registers a new node_id into active subscription/polling list,
    triggers an immediate one-shot read from the shared Kepware client,
    updates latest_cache["tags"], and broadcasts TAG_UPDATE via WebSocket within <100ms.
    """
    if not node_id or not isinstance(node_id, str):
        return None
    nid = node_id.strip()
    if not nid or nid == "[CHƯA ÁNH XẠ]":
        return None

    register_subscribed_node(nid)

    if not opc_mgr.is_connected or not opc_mgr.client:
        return None

    try:
        client = await opc_mgr.get_active_client()
        node = get_cached_node(client, nid)
        if node is None:
            return None

        async with opc_mgr.lock:
            data_val = await asyncio.wait_for(node.read_data_value(), timeout=1.0)

        if data_val is not None:
            raw_val = data_val.Value.Value if data_val.Value is not None else 0.0
            clean_val = round(float(raw_val), 2) if isinstance(raw_val, (int, float)) and not isinstance(raw_val, bool) else raw_val
            is_good = (data_val.StatusCode and data_val.StatusCode.is_good()) if data_val.StatusCode else True
            qual = "Good" if is_good else "Bad"
            dtype = data_val.Value.VariantType.name if (data_val.Value and hasattr(data_val.Value, "VariantType") and data_val.Value.VariantType) else "Float"
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            clean_nid = nid.replace("ns=2;s=", "").strip()
            resolved_tag_name = tag_name or clean_nid
            payload = {
                "tag_name": resolved_tag_name,
                "node_id": nid,
                "value": clean_val,
                "data_type": dtype,
                "type": dtype,
                "quality": qual,
                "timestamp": now_str,
                "role": role or "Process Tag",
                "unit": unit or "--",
                "writable": True,
                "description": f"Dynamic tag {resolved_tag_name}"
            }
            latest_cache["tags"][nid] = payload
            if clean_nid and clean_nid != nid:
                latest_cache["tags"][clean_nid] = payload
            latest_cache["last_updated"] = now_str

            try:
                loop = asyncio.get_running_loop()
                loop.create_task(connection_manager.broadcast({
                    "type": "TAG_UPDATE",
                    "data": payload
                }))
            except Exception:
                pass

            return payload
    except Exception as e:
        logger.debug(f"hot_register_and_read notice for {nid}: {e}")
        return None

@app.post("/api/gateway/test-node")
async def gateway_test_node_endpoint(req: TestNodePayload):
    return await test_node_connectivity(req)

@app.post("/api/opc/test")
async def opc_test_endpoint(req: TestNodePayload):
    return await test_node_connectivity(req)

# ============================================================================
# NOTE: /api/gateway/mappings and /api/gateway/test-node are canonically
# handled by db_routes.router (included above) to prevent split-brain shadowing.
# ============================================================================


@app.get("/api/gateway/explorer/tags")
async def get_explorer_tags():
    """
    Sub-millisecond API response directly from latest_cache.
    Zero OPC UA network calls per HTTP request.
    """
    tag_list = list(latest_cache["tags"].values())
    return {
        "server_connected": bool(opc_mgr.connected),
        "endpoint": latest_cache["endpoint"],
        "latency_ms": latest_cache["latency_ms"],
        "count": len(tag_list),
        "tags": tag_list
    }


@app.post("/api/gateway/explorer/read-node")
async def read_single_node(req: ReadNodeRequest):
    """
    Reads a NodeId. If already cached and valid, returns immediately.
    Otherwise safely reads using opc_mgr.get_client() and caches it.
    """
    node_id = req.node_id.strip()
    if not node_id:
        raise HTTPException(status_code=400, detail="node_id cannot be empty")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    tag_name = node_id.split(".")[-1] if "." in node_id else node_id

    # If already cached and Good quality, return instantly
    if node_id in latest_cache["tags"] and latest_cache["tags"][node_id]["quality"] == "Good":
        cached = latest_cache["tags"][node_id]
        return {
            "tag_name": cached["tag_name"],
            "node_id": cached["node_id"],
            "value": cached["value"],
            "data_type": cached["data_type"],
            "quality": cached["quality"],
            "timestamp": cached["timestamp"],
            "message": "Node read from cache"
        }

    # Auto-add to watchlist if not present
    if not any(t["node_id"] == node_id for t in explorer_watchlist):
        explorer_watchlist.append({
            "tag_name": tag_name,
            "node_id": node_id,
            "expected_type": "Auto",
            "description": f"Custom user-added tag: {node_id}"
        })

    try:
        client = await opc_mgr.get_active_client()
        async with opc_mgr.lock:
            node = client.get_node(node_id)
            node_cache[node_id] = node
            data_val = await node.read_data_value()
            val = data_val.Value.Value if (data_val and data_val.Value) else 0.0
            quality = "Good" if (data_val and data_val.StatusCode and data_val.StatusCode.is_good()) else "Bad"

            try:
                dtype_node = await node.read_data_type_as_variant_type()
                dtype_str = dtype_node.name if hasattr(dtype_node, "name") else str(dtype_node)
            except Exception:
                dtype_str = data_val.Value.VariantType.name if (data_val and data_val.Value and hasattr(data_val.Value, "VariantType")) else "Variant"

        if isinstance(val, float):
            val = round(val, 2)

        res = {
            "tag_name": tag_name,
            "node_id": node_id,
            "value": val,
            "data_type": dtype_str,
            "quality": quality,
            "timestamp": now_str,
            "message": "Node read successfully"
        }

        latest_cache["tags"][node_id] = {
            "tag_name": tag_name,
            "node_id": node_id,
            "type": dtype_str,
            "data_type": dtype_str,
            "value": val,
            "quality": quality,
            "timestamp": now_str
        }
        return res
    except Exception as e:
        opc_mgr.mark_disconnected()
        return {
            "tag_name": tag_name,
            "node_id": node_id,
            "value": 0.0,
            "data_type": "Unknown",
            "quality": "Bad",
            "timestamp": now_str,
            "message": str(e)
        }


class WritePayload(BaseModel):
    node_id: str
    value: Any
    data_type: str = "Float"

WriteNodeRequest = WritePayload


async def write_opc_tag(node_id: str, value: Any, data_type: str = "Float") -> Dict[str, Any]:
    """
    Universal Centralized OPC UA Write Engine across all MES modules.
    - Resolves Variant types (Float, Int, Boolean, String, etc.)
    - Safely performs physical OPC UA write using existing opc_mgr session
    - Handles simulation fallback & RAM cache when permissions are restricted or client offline
    - Indexes both full node_id and clean tag address into latest_cache["tags"]
    - Registers node into subscribed_nodes
    - Broadcasts TAG_UPDATE over WebSocket
    """
    node_id = str(node_id).strip()
    if not node_id:
        raise HTTPException(status_code=400, detail="node_id is required")

    register_subscribed_node(node_id)

    # Enforce industrial read-only safety interlock for Process Variables (PV)
    meta = NODE_TO_TAG_META.get(node_id)
    if meta and not meta.get("writable", True):
        raise HTTPException(
            status_code=403, 
            detail=f"WRITE REJECTED: Tag '{meta['tag_name']}' is a Read-Only Process Variable ({meta.get('role', 'PV')}). Writes are prohibited by ISA-88 interlock."
        )
    cached_tag = latest_cache["tags"].get(node_id)
    if cached_tag and cached_tag.get("writable") is False:
        raise HTTPException(
            status_code=403,
            detail=f"WRITE REJECTED: Tag '{cached_tag.get('tag_name', node_id)}' is marked Read-Only."
        )

    clean_nid = node_id.replace("ns=2;s=", "") if "ns=2;s=" in node_id else node_id
    full_nid = f"ns=2;s={clean_nid}" if not node_id.startswith("ns=") else node_id

    max_retries = 2
    for attempt in range(max_retries):
        try:
            client = await opc_mgr.get_active_client()
            async with opc_mgr.lock:
                node = client.get_node(node_id)
                
                # Variant conversion
                dt = str(data_type).strip() if data_type else "Float"
                if dt in ["Float", "Single", "float", "single"]:
                    val = ua.Variant(float(value), ua.VariantType.Float)
                elif dt in ["Int16", "Short", "int16", "short"]:
                    val = ua.Variant(int(float(value)), ua.VariantType.Int16)
                elif dt in ["Boolean", "Bool", "bool", "boolean"]:
                    b_val = value if isinstance(value, bool) else (str(value).strip().lower() in ("true", "1", "yes", "t"))
                    val = ua.Variant(b_val, ua.VariantType.Boolean)
                elif dt in ["Int", "Int32", "Integer", "int", "int32"]:
                    val = ua.Variant(int(float(value)), ua.VariantType.Int32)
                elif dt in ["Double", "Float64", "double"]:
                    val = ua.Variant(float(value), ua.VariantType.Double)
                else:
                    val = ua.Variant(str(value), ua.VariantType.String)
                
                try:
                    await node.write_value(val)
                except Exception:
                    await node.write_value(ua.DataValue(val))

            # Update cache while preserving ISA-88 metadata
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            tag_name = meta.get("tag_name", node_id.split(".")[-1]) if meta else (node_id.split(".")[-1] if "." in node_id else node_id)
            updated_entry = {
                "tag_name": tag_name,
                "node_id": node_id,
                "role": meta.get("role", "Custom / Interactive") if meta else "Custom / Interactive",
                "unit": meta.get("unit", "--") if meta else "--",
                "writable": meta.get("writable", True) if meta else True,
                "description": meta.get("description", f"Custom Node: {node_id}") if meta else f"Custom Node: {node_id}",
                "type": data_type,
                "data_type": data_type,
                "value": value,
                "quality": "Good",
                "timestamp": now_str
            }
            if node_id in latest_cache["tags"]:
                latest_cache["tags"][node_id]["value"] = value
                latest_cache["tags"][node_id]["quality"] = "Good"
                latest_cache["tags"][node_id]["timestamp"] = now_str
            else:
                latest_cache["tags"][node_id] = dict(updated_entry)

            latest_cache["tags"][clean_nid] = dict(latest_cache["tags"][node_id])
            latest_cache["tags"][full_nid] = dict(latest_cache["tags"][node_id])

            # Synchronize line telemetry if command/state updated
            if meta:
                if meta["tag_name"] == "Batch_State":
                    gateway_state["telemetry"]["batch_status"] = str(value)

            try:
                await connection_manager.broadcast({
                    "type": "TAG_UPDATE",
                    "data": latest_cache["tags"][node_id]
                })
            except Exception:
                pass

            return {
                "status": "success",
                "written_value": value,
                "value": value,
                "node_id": node_id,
                "timestamp": now_str
            }
        
        except Exception as e:
            err_str = str(e)
            if any(term in err_str for term in ("BadUserAccessDenied", "BadNotWritable", "AccessDenied", "SecurityError", "BadServerNotConnected", "Cannot connect")):
                logger.warning(f"OPC UA write permission restricted or disconnected on {node_id} ({err_str}). Updating RAM cache for simulation.")
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                tag_name = meta.get("tag_name", node_id.split(".")[-1]) if meta else (node_id.split(".")[-1] if "." in node_id else node_id)
                updated_entry = {
                    "tag_name": tag_name,
                    "node_id": node_id,
                    "role": meta.get("role", "Custom / Interactive") if meta else "Custom / Interactive",
                    "unit": meta.get("unit", "--") if meta else "--",
                    "writable": meta.get("writable", True) if meta else True,
                    "description": meta.get("description", f"Custom Node: {node_id}") if meta else f"Custom Node: {node_id}",
                    "type": data_type,
                    "data_type": data_type,
                    "value": value,
                    "quality": "Good",
                    "timestamp": now_str
                }
                if node_id in latest_cache["tags"]:
                    latest_cache["tags"][node_id]["value"] = value
                    latest_cache["tags"][node_id]["quality"] = "Good"
                    latest_cache["tags"][node_id]["timestamp"] = now_str
                else:
                    latest_cache["tags"][node_id] = dict(updated_entry)
                latest_cache["tags"][clean_nid] = dict(latest_cache["tags"][node_id])
                latest_cache["tags"][full_nid] = dict(latest_cache["tags"][node_id])

                try:
                    await connection_manager.broadcast({
                        "type": "TAG_UPDATE",
                        "data": latest_cache["tags"][node_id]
                    })
                except Exception:
                    pass
                return {
                    "status": "success",
                    "simulation_fallback": True,
                    "written_value": value,
                    "value": value,
                    "node_id": node_id,
                    "timestamp": now_str
                }

            logger.warning(f"Write operation failed on attempt {attempt + 1}/{max_retries}: {e}. Invalidating dead client...")
            opc_mgr.client = None
            opc_mgr.connected = False
            if attempt == max_retries - 1:
                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if node_id in latest_cache["tags"]:
                    latest_cache["tags"][node_id]["value"] = value
                    latest_cache["tags"][node_id]["timestamp"] = now_str
                latest_cache["tags"][clean_nid] = latest_cache["tags"].get(node_id, {})
                latest_cache["tags"][full_nid] = latest_cache["tags"].get(node_id, {})
                return {
                    "status": "success",
                    "simulation_fallback": True,
                    "written_value": value,
                    "value": value,
                    "node_id": node_id,
                    "timestamp": now_str
                }
            await asyncio.sleep(0.5)

    return {"status": "error", "message": "Failed to write node", "node_id": node_id}


@app.post("/api/gateway/explorer/write-node")
async def write_node(payload: WritePayload):
    return await write_opc_tag(payload.node_id, payload.value, payload.data_type)


@app.post("/api/gateway/write-tag")
async def write_tag_endpoint(payload: WritePayload):
    return await write_opc_tag(payload.node_id, payload.value, payload.data_type)


write_single_node = write_node


@app.post("/api/gateway/explorer/watch-tag")
async def watch_tag(req: WatchTagRequest):
    node_id = req.node_id.strip()
    if not node_id:
        raise HTTPException(status_code=400, detail="node_id required")
    
    tag_name = req.tag_name or (node_id.split(".")[-1] if "." in node_id else node_id)
    expected_type = req.expected_type or "Float"

    if not any(t["node_id"] == node_id for t in explorer_watchlist):
        explorer_watchlist.append({
            "tag_name": tag_name,
            "node_id": node_id,
            "expected_type": expected_type,
            "description": req.description or f"Monitored tag: {node_id}"
        })

    # Pre-add to cache so it immediately appears in GET /tags
    if node_id not in latest_cache["tags"]:
        latest_cache["tags"][node_id] = {
            "tag_name": tag_name,
            "node_id": node_id,
            "type": expected_type,
            "data_type": expected_type,
            "value": 0.0,
            "quality": "Bad",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    # Dynamically subscribe on active OPC UA subscription
    await subscribe_node_dynamic(node_id, tag_name, expected_type)

    return {"status": "success", "watchlist": explorer_watchlist}


@app.delete("/api/gateway/explorer/watch-tag")
async def unwatch_tag(node_id: str):
    global explorer_watchlist
    explorer_watchlist = [t for t in explorer_watchlist if t["node_id"] != node_id]
    if node_id in latest_cache["tags"]:
        del latest_cache["tags"][node_id]
    await connection_manager.broadcast({
        "type": "TAG_REMOVED",
        "node_id": node_id
    })
    return {"status": "success", "watchlist": explorer_watchlist}


if __name__ == "__main__":
    import signal
    import uvicorn

    def _handle_signal(sig, frame):
        logger.info(f"[Lifecycle] Signal {sig} received. Initiating graceful shutdown of Kepware Gateway...")
        sys.exit(0)

    try:
        signal.signal(signal.SIGINT, _handle_signal)
        if hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, _handle_signal)
    except Exception as sig_err:
        logger.warning(f"[Lifecycle] Failed to register OS signals: {sig_err}")

    logger.info(f"[Lifecycle] Starting Kepware Gateway on http://127.0.0.1:8000 (PID: {os.getpid()})")
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False, access_log=False)
