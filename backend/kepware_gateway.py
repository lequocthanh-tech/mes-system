import sys
import os
import asyncio
import json
import time
import logging
import socket
import pyodbc
from datetime import datetime
from typing import Any, List, Dict, Optional
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

try:
    from . import db_routes, db_connector, db_sync_engine, main, historian
    from .store_forward_engine import db_engine
    from .db_connector import execute_query, verify_mes_database_status
except (ImportError, ValueError):
    import db_routes
    import db_connector
    import db_sync_engine
    import main
    import historian
    from store_forward_engine import db_engine
    from db_connector import execute_query, verify_mes_database_status

# Track current active production order for Historian datalogging
active_running_order_code: Optional[str] = None

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OPC_Gateway")

# Mute noisy internal OPC UA subscription & client logs
logging.getLogger("asyncua").setLevel(logging.WARNING)
logging.getLogger("asyncua.common.subscription").setLevel(logging.WARNING)
logging.getLogger("asyncua.client.ua_client.UASocketProtocol").setLevel(logging.WARNING)
logging.getLogger("asyncua.client.ua_client.UaClient").setLevel(logging.WARNING)

# Strict DB Offline Circuit Breaker: If DB fails once, permanently bypass all DB logging
db_logging_disabled: bool = False

def _sync_db_worker(query: str, params: Optional[tuple] = None):
    """Executes query with 1s timeout in detached worker thread; disables further DB attempts if offline."""
    global db_logging_disabled
    if db_logging_disabled:
        return
    try:
        execute_query(query, params, timeout=1)
    except Exception as db_err:
        db_logging_disabled = True
        logger.warning(f"SQL Database is offline ({db_err}). Completely disabling background SQL logging to protect event loop.")

async def safe_db_execute_detached(query: str, params: Optional[tuple] = None):
    """
    Decoupled database execution: runs in a detached thread with strict 1-second timeout.
    Fails silently if SQL Server is offline, completely protecting the OPC UA event loop.
    """
    global db_logging_disabled
    if db_logging_disabled:
        return
    try:
        await asyncio.wait_for(
            asyncio.to_thread(_sync_db_worker, query, params),
            timeout=1.0
        )
    except Exception:
        db_logging_disabled = True

def dispatch_db_log(query: str, params: Optional[tuple] = None):
    """Non-blocking fire-and-forget background database task dispatcher; strictly bypassed when DB is offline."""
    global db_logging_disabled
    if db_logging_disabled:
        return
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(safe_db_execute_detached(query, params))
    except RuntimeError:
        pass
    except Exception:
        pass

# Kepware Connection Config
KEPWARE_URL = "opc.tcp://127.0.0.1:49320"
TAG_TEMP_ACT = "ns=2;s=Siemens.Line1.Temperature_ACT"
TAG_WEIGHT_ACT = "ns=2;s=Siemens.Line1.Weight_ACT"
TAG_BATCH_STATUS = "ns=2;s=Siemens.Line1.Batch_Status"

# ============================================================================
# DYNAMIC CONFIGURATION STORAGE (backend/tag_mappings.json)
# ============================================================================
MAPPINGS_FILE = os.path.join(os.path.dirname(__file__), "tag_mappings.json")

DEFAULT_ESSENTIAL_MES_TAGS: Dict[str, Dict[str, Any]] = {
    # Process Actual Values (PV - Read Only)
    "Temp_Sterilizer_PV": {
        "node_id": "ns=2;s=Simulation Examples.Functions.Ramp2",
        "role": "PH_HEATING / PV",
        "unit": "°C",
        "writable": False,
        "description": "Sterilizer chamber actual temperature"
    },
    "Tank_Level_PV": {
        "node_id": "ns=2;s=Simulation Examples.Functions.Random1",
        "role": "UP_MIXING / Level",
        "unit": "L",
        "writable": False,
        "description": "Buffer tank liquid level"
    },
    "Agitator_Speed_PV": {
        "node_id": "ns=2;s=Simulation Examples.Functions.User2",
        "role": "PH_AGITATING / Speed",
        "unit": "RPM",
        "writable": False,
        "description": "Mixer motor agitator feedback speed"
    },
    # Process Setpoints & Controls (SP / CMD - Read/Write)
    "Recipe_Temp_SP": {
        "node_id": "ns=2;s=Simulation Examples.Functions.Test_SP",
        "role": "Control Recipe / Temp SP",
        "unit": "°C",
        "writable": True,
        "description": "Target temperature setpoint from Master Recipe"
    },
    "Batch_State": {
        "node_id": "ns=2;s=Simulation Examples.Functions.User1",
        "role": "State Machine (PackML)",
        "unit": "State",
        "writable": True,
        "description": "ISA-88 Unit State: 1=IDLE, 2=RUNNING, 3=COMPLETE, 4=STOPPED"
    },
    "Batch_Start_CMD": {
        "node_id": "ns=2;s=Simulation Examples.Functions.User3",
        "role": "Command / Start Pulse",
        "unit": "Bool",
        "writable": True,
        "description": "Start trigger command bit for execution phase"
    },
    "Handshake_Loaded_OK": {
        "node_id": "ns=2;s=Simulation Examples.Functions.User4",
        "role": "Handshake / Recipe OK",
        "unit": "Bool",
        "writable": True,
        "description": "PLC acknowledgement handshake bit for recipe download"
    }
}

def load_tag_mappings() -> Dict[str, Dict[str, Any]]:
    if not os.path.exists(MAPPINGS_FILE):
        try:
            with open(MAPPINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(DEFAULT_ESSENTIAL_MES_TAGS, f, indent=2, ensure_ascii=False)
            logger.info(f"Initialized {MAPPINGS_FILE} with default essential tags.")
        except Exception as e:
            logger.error(f"Error creating {MAPPINGS_FILE}: {e}")
            return dict(DEFAULT_ESSENTIAL_MES_TAGS)
    try:
        with open(MAPPINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict) and data:
                return data
    except Exception as e:
        logger.error(f"Error reading {MAPPINGS_FILE}: {e}")
    return dict(DEFAULT_ESSENTIAL_MES_TAGS)

def save_tag_mappings(mappings: Dict[str, Dict[str, Any]]):
    with open(MAPPINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(mappings, f, indent=2, ensure_ascii=False)

ESSENTIAL_MES_TAGS: Dict[str, Dict[str, Any]] = load_tag_mappings()

# Node ID reverse index for sub-millisecond lookup
NODE_TO_TAG_META: Dict[str, Dict[str, Any]] = {
    info["node_id"]: {"tag_name": tag_name, **info}
    for tag_name, info in ESSENTIAL_MES_TAGS.items()
}

# Legacy default list compatibility
DEFAULT_TAG_DEFINITIONS = [
    {"name": tag_name, "node": info["node_id"], "type": "Float" if info.get("unit") in ("°C", "RPM") else ("Boolean" if info.get("unit") == "Bool" else ("String" if tag_name == "Batch_State" else "Int16"))}
    for tag_name, info in ESSENTIAL_MES_TAGS.items()
]

# In-memory watchlist initialized strictly with the essential whitelisted tags
explorer_watchlist: List[Dict[str, Any]] = [
    {
        "tag_name": tag_name,
        "node_id": info["node_id"],
        "role": info.get("role", "General Process Tag"),
        "unit": info.get("unit", "--"),
        "writable": info.get("writable", True),
        "expected_type": "Float" if info.get("unit") in ("°C", "RPM") else ("Boolean" if info.get("unit") == "Bool" else ("String" if tag_name == "Batch_State" else "Int16")),
        "description": info.get("description", "")
    }
    for tag_name, info in ESSENTIAL_MES_TAGS.items()
]

def reload_tag_metadata():
    global ESSENTIAL_MES_TAGS, NODE_TO_TAG_META, explorer_watchlist
    ESSENTIAL_MES_TAGS = load_tag_mappings()
    NODE_TO_TAG_META = {
        info["node_id"]: {"tag_name": tag_name, **info}
        for tag_name, info in ESSENTIAL_MES_TAGS.items()
    }
    explorer_watchlist.clear()
    for tag_name, info in ESSENTIAL_MES_TAGS.items():
        explorer_watchlist.append({
            "tag_name": tag_name,
            "node_id": info["node_id"],
            "role": info.get("role", "General Process Tag"),
            "unit": info.get("unit", "--"),
            "writable": info.get("writable", True),
            "expected_type": "Float" if info.get("unit") in ("°C", "RPM") else ("Boolean" if info.get("unit") == "Bool" else ("String" if tag_name == "Batch_State" else "Int16")),
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
    for tag_name, info in ESSENTIAL_MES_TAGS.items():
        node_id = info["node_id"]
        unit = info["unit"]
        if unit in ("°C", "RPM"):
            dt = "Float"
            val = 0.0
        elif unit == "L":
            dt = "Int16"
            val = 0
        elif unit == "Bool":
            dt = "Boolean"
            val = False
        elif unit == "State":
            dt = "String"
            val = "IDLE"
        else:
            dt = "Float"
            val = 0.0

        if tag_name == "Recipe_Temp_SP":
            val = 100.0

        cache[node_id] = {
            "tag_name": tag_name,
            "node_id": node_id,
            "role": info["role"],
            "unit": unit,
            "writable": info["writable"],
            "description": info["description"],
            "type": dt,
            "data_type": dt,
            "value": val,
            "quality": "Bad",
            "timestamp": "--:--:--"
        }
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
last_sql_log_time: float = 0.0


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
            "tags": list(latest_cache["tags"].values())
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
                tag_name = meta["tag_name"]
                role = meta["role"]
                unit = meta["unit"]
                writable = meta["writable"]
                description = meta["description"]
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

            # Update RAM cache instantly for sub-millisecond HTTP / WS reads
            latest_cache["tags"][node_id_str] = payload
            latest_cache["last_updated"] = timestamp_str

            # Update Line 1 telemetry if applicable (mapped to essential tags)
            if tag_name == "Temp_Sterilizer_PV" or node_id_str == TAG_TEMP_ACT:
                gateway_state["telemetry"]["temperature_act"] = float(clean_val) if isinstance(clean_val, (int, float)) else 0.0
            elif tag_name == "Tank_Level_PV" or node_id_str == TAG_WEIGHT_ACT:
                gateway_state["telemetry"]["weight_act"] = float(clean_val) if isinstance(clean_val, (int, float)) else 0.0
            elif tag_name == "Batch_State" or node_id_str == TAG_BATCH_STATUS:
                gateway_state["telemetry"]["batch_status"] = str(clean_val)

            # Automated Datalog Ingestion via Store-and-Forward if RUNNING (throttled to 1s)
            now_ts = time.time()
            if str(gateway_state["telemetry"].get("batch_status", "")).upper() in ("RUNNING", "2") and (now_ts - last_sql_log_time >= 1.0):
                last_sql_log_time = now_ts
                curr_order = active_running_order_code or "WO_ACTIVE"
                db_engine.log_datalog(curr_order, "Temp_Sterilizer_PV", float(gateway_state["telemetry"]["temperature_act"]), "°C")
                db_engine.log_datalog(curr_order, "Tank_Level_PV", float(gateway_state["telemetry"]["weight_act"]), "L")

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

    async def get_active_client(self) -> Client:
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
            nodes_to_subscribe[info["node_id"]] = tag_name

        # Include custom watched tags if dynamically added
        for item in explorer_watchlist:
            if item["node_id"] not in nodes_to_subscribe:
                nodes_to_subscribe[item["node_id"]] = item.get("tag_name") or item["node_id"].split(".")[-1]

        subscribed_count = 0
        for node_id, tag_name in nodes_to_subscribe.items():
            try:
                node = self.client.get_node(node_id)
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
                                "tag_name": meta["tag_name"],
                                "node_id": node_id,
                                "role": meta["role"],
                                "unit": meta["unit"],
                                "writable": meta["writable"],
                                "description": meta["description"],
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
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(connection_manager.broadcast({
                "type": "STATUS_UPDATE",
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

    async def force_disconnect(self):
        self.mark_disconnected()

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
            await opc_mgr.get_active_client()
            await asyncio.sleep(2.0)
            async with opc_mgr.lock:
                if opc_mgr.client is not None:
                    # Active ping resets Kepware's 60s session inactivity timer
                    await opc_mgr.client.nodes.server_state.read_value()
        except asyncio.CancelledError:
            break
        except Exception as err:
            logger.warning(f"Kepware watchdog detected disconnect or offline runtime: {err}")
            opc_mgr.mark_disconnected()
            try:
                await asyncio.sleep(1.5)
            except asyncio.CancelledError:
                break


async def worker_telemetry_streamer():
    """
    Continuous WebSocket Telemetry Streamer:
    - Runs every 1 second.
    - If clients are connected, streams essential telemetry (Temp_Sterilizer_PV, Tank_Level_PV,
      Agitator_Speed_PV, Batch_State, Handshake_Loaded_OK).
    - If Kepware is temporarily offline, streams cached telemetry values without dropping
      the WebSocket client connection.
    """
    while True:
        try:
            await asyncio.sleep(1.0)
            if connection_manager.active_connections:
                essential_names = ["Temp_Sterilizer_PV", "Tank_Level_PV", "Agitator_Speed_PV", "Batch_State", "Handshake_Loaded_OK"]
                tags_data = {}
                for node_id, t in latest_cache["tags"].items():
                    tag_name = t.get("tag_name")
                    if tag_name in essential_names or node_id in essential_names:
                        tags_data[tag_name or node_id] = t

                await connection_manager.broadcast({
                    "type": "STREAM_HEARTBEAT",
                    "server_connected": bool(opc_mgr.connected),
                    "telemetry": gateway_state["telemetry"],
                    "essential_tags": tags_data,
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Telemetry streamer exception: {e}")


async def worker_historian_logger():
    """
    Historian Time-Series Background Worker:
    - Runs periodically every 1.0 second.
    - While an order is 'Running', logs current process variables into dbo.PLC_Datalog
      (OrderCode, TagName, Value, Unit, ReadTime).
    - Ticks EquipmentRuntimeEngine every 1.0s to track runtime hours and check maintenance limits.
    - Decoupled from the OPC event loop; fails safely if DB is momentarily unreachable.
    """
    global active_running_order_code
    while True:
        try:
            await asyncio.sleep(1.0)

            # 1. Tick Equipment Runtime Engine
            try:
                await historian.runtime_engine.tick_1s()
            except Exception as rt_err:
                logger.debug(f"Runtime tracker notice: {rt_err}")

            # 2. Process Telemetry Historian Logging
            order_code = active_running_order_code
            if not order_code and gateway_state.get("batch_command") == "START":
                order_code = "WO_ACTIVE"

            if order_code:
                # Extract live process variables
                pv_dict: Dict[str, float] = {}
                for node_id, t in latest_cache["tags"].items():
                    tag_name = t.get("tag_name") or node_id
                    val = t.get("value")
                    if val is not None and isinstance(val, (int, float)):
                        pv_dict[tag_name] = float(val)

                # Fallback to gateway simulated telemetry if tag not yet read
                temp_val = pv_dict.get("Temp_Sterilizer_PV", float(gateway_state["telemetry"].get("temperature_act", 138.0)))
                weight_val = pv_dict.get("Tank_Level_PV", float(gateway_state["telemetry"].get("weight_act", 8500.0)))
                agitator_val = pv_dict.get("Agitator_Speed_PV", 120.0 if gateway_state.get("batch_command") == "START" else 0.0)
                cooling_val = pv_dict.get("Temp_Cooling_PV", 4.1)

                logs_to_write = [
                    (order_code, "Temp_Sterilizer_PV", temp_val, "°C"),
                    (order_code, "Tank_Level_PV", weight_val, "L"),
                    (order_code, "Agitator_Speed_PV", agitator_val, "RPM"),
                    (order_code, "Temp_Cooling_PV", cooling_val, "°C")
                ]

                def _record_logs():
                    for oc, tn, v, u in logs_to_write:
                        db_engine.log_datalog(oc, tn, v, u)

                await asyncio.to_thread(_record_logs)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.debug(f"Historian logging notice: {e}")



@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-initialize database schema asynchronously if needed
    try:
        try:
            from .init_sql import init_mes_database
        except (ImportError, ValueError):
            from init_sql import init_mes_database
        asyncio.create_task(asyncio.to_thread(init_mes_database))
    except Exception as e:
        logger.debug(f"DB auto-init skipped: {e}")

    supervisor_task = asyncio.create_task(worker_kepware_supervisor())
    streamer_task = asyncio.create_task(worker_telemetry_streamer())
    historian_task = asyncio.create_task(worker_historian_logger())
    yield
    supervisor_task.cancel()
    streamer_task.cancel()
    historian_task.cancel()
    try:
        await supervisor_task
    except asyncio.CancelledError:
        pass
    try:
        await streamer_task
    except asyncio.CancelledError:
        pass
    try:
        await historian_task
    except asyncio.CancelledError:
        pass
    if opc_mgr.client is not None:
        try:
            await opc_mgr.client.disconnect()
        except Exception:
            pass


app = FastAPI(title="MES OPC UA Gateway (KEPServerEX)", lifespan=lifespan)
app.include_router(main.api_router)
app.include_router(db_routes.router)

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
    kepware_online = bool(opc_mgr.connected)
    return {
        "sql_online": sql_online,
        "kepware_online": kepware_online,
        "port": 8000,
        "status": "connected" if (sql_online or kepware_online) else "standby"
    }


@app.post("/api/sql/test")
async def test_sql_link(request: Request):
    """Test endpoint for SystemConfigView."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    alive = await asyncio.to_thread(verify_mes_database_status)
    if alive:
        return {"ok": True, "message": "SQL Server (localhost\\WINCC / MES_Milk_Production) connection verified"}
    return JSONResponse(
        status_code=503,
        content={"ok": False, "message": "Connection Failed: SQL Server (localhost\\WINCC / MES_Milk_Production) unreachable."}
    )





@app.get("/api/gateway/status")
async def get_status():
    if opc_mgr.connected:
        return {
            "status": "connected",
            "server_connected": True,
            "latency_ms": latest_cache["latency_ms"],
            "active_tags": len(latest_cache["tags"])
        }
    else:
        return {
            "status": "disconnected",
            "server_connected": False,
            "latency_ms": 0,
            "active_tags": 0
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
        cur_temp = float(gateway_state["telemetry"].get("temperature_act", 138.0))
        cur_weight = float(gateway_state["telemetry"].get("weight_act", 8500.0))

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
        if not active_running_order_code:
            active_running_order_code = "WO_Batch_12"
        # Transition active batch equipments to RUNNING in SQL Server
        def _start_equipments():
            for eq_code in ["PUMP_INLET", "AGITATOR_MIX", "HEATER_UHT", "CHILLER_COOL"]:
                try:
                    historian.update_equipment_status(eq_code, "RUNNING", trigger_source="BATCH_START_COMMAND")
                except Exception as e:
                    logger.debug(f"Failed to start equipment {eq_code}: {e}")
        asyncio.create_task(asyncio.to_thread(_start_equipments))

    elif upper_cmd in ("STOP", "RESET", "ABORT"):
        active_running_order_code = None
        # Transition active batch equipments to STOP in SQL Server
        def _stop_equipments():
            for eq_code in ["PUMP_INLET", "AGITATOR_MIX", "HEATER_UHT", "CHILLER_COOL", "PUMP_OUTLET"]:
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
        # Even if physical Kepware is disconnected, return success in simulated workbench mode
        return {"status": "success", "message": f"Command {cmd.command} acknowledged (simulation/offline mode: {e})"}



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
# DYNAMIC TAG MAPPING & NODE VALIDATION ENDPOINTS
# ============================================================================

class TestNodePayload(BaseModel):
    node_id: str


@app.get("/api/gateway/mappings")
async def get_tag_mappings():
    """
    Returns the current dictionary of tag definitions and their Node IDs.
    """
    return {
        "status": "success",
        "mappings": ESSENTIAL_MES_TAGS
    }


@app.put("/api/gateway/mappings")
async def update_tag_mappings(req: Dict[str, Any]):
    """
    Receives an updated list/dictionary of mappings, writes it to tag_mappings.json,
    and triggers an in-memory re-subscription so that the live WebSocket feed
    immediately switches to reading the new Kepware nodes without server downtime.
    """
    new_mappings = req.get("mappings") if ("mappings" in req and isinstance(req["mappings"], dict)) else req
    if not isinstance(new_mappings, dict) or not new_mappings:
        raise HTTPException(status_code=400, detail="Invalid mappings dictionary provided")

    sanitized: Dict[str, Dict[str, Any]] = {}
    for tag_name, meta in new_mappings.items():
        if not isinstance(meta, dict):
            continue
        node_id = str(meta.get("node_id", "")).strip()
        if not node_id:
            continue
        sanitized[tag_name] = {
            "node_id": node_id,
            "role": meta.get("role", "General Process Tag"),
            "unit": meta.get("unit", "--"),
            "writable": bool(meta.get("writable", False)),
            "description": meta.get("description", f"OPC UA node for {tag_name}")
        }

    if not sanitized:
        raise HTTPException(status_code=400, detail="No valid tag mappings found in request")

    # Persist to disk
    save_tag_mappings(sanitized)
    reload_tag_metadata()

    # Rebuild in-memory cache for new nodes
    endpoint = latest_cache.get("endpoint", KEPWARE_URL)
    server_conn = latest_cache.get("server_connected", False)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    new_tags_cache = {}
    for tag_name, meta in sanitized.items():
        node_id = meta["node_id"]
        unit = meta["unit"]
        if unit in ("°C", "RPM"):
            dt = "Float"
            val = 0.0
        elif unit == "L":
            dt = "Int16"
            val = 0
        elif unit == "Bool":
            dt = "Boolean"
            val = False
        elif unit == "State":
            dt = "String"
            val = "IDLE"
        else:
            dt = "Float"
            val = 0.0

        if node_id in latest_cache["tags"]:
            val = latest_cache["tags"][node_id].get("value", val)
            dt = latest_cache["tags"][node_id].get("data_type", dt)

        new_tags_cache[node_id] = {
            "tag_name": tag_name,
            "node_id": node_id,
            "value": val,
            "data_type": dt,
            "type": dt,
            "quality": "Good" if server_conn else "Bad",
            "timestamp": now_str,
            "role": meta["role"],
            "unit": meta["unit"],
            "writable": meta["writable"],
            "description": meta["description"]
        }

    latest_cache["tags"] = new_tags_cache

    # Resubscribe live OPC UA client without downtime
    try:
        await opc_mgr.resubscribe()
    except Exception as resub_err:
        logger.warning(f"Error during resubscription: {resub_err}")

    # Broadcast updated snapshot to WebSocket clients immediately
    try:
        await connection_manager.broadcast({
            "type": "SNAPSHOT",
            "server_connected": opc_mgr.connected,
            "endpoint": endpoint,
            "tags": list(latest_cache["tags"].values()),
            "timestamp": now_str
        })
    except Exception:
        pass

    return {
        "status": "success",
        "message": f"Successfully updated {len(sanitized)} tag mappings and resubscribed live OPC UA feed.",
        "mappings": sanitized
    }


@app.post("/api/gateway/test-node")
async def test_node_connectivity(req: TestNodePayload):
    """
    Accepts { "node_id": "ns=2;s=..." }, attempts a single
    client.get_node(node_id).read_data_value(), and returns
    { "valid": true/false, "value": ..., "datatype": ... } to verify
    the tag exists in Kepware before saving.
    """
    node_id = req.node_id.strip()
    if not node_id:
        return {"valid": False, "node_id": node_id, "message": "Node ID cannot be empty"}
    try:
        client = await opc_mgr.get_active_client()
        async with opc_mgr.lock:
            node = client.get_node(node_id)
            data_val = await node.read_data_value()
            if data_val is None or (data_val.StatusCode and not data_val.StatusCode.is_good()):
                status_name = str(data_val.StatusCode) if data_val else "None"
                return {
                    "valid": False,
                    "node_id": node_id,
                    "message": f"Kepware returned bad status: {status_name}"
                }
            raw_val = data_val.Value.Value if (data_val and data_val.Value) else 0.0
            clean_val = round(raw_val, 2) if isinstance(raw_val, float) else raw_val
            dtype = "Variant"
            if hasattr(data_val.Value, "VariantType") and data_val.Value.VariantType:
                dtype = data_val.Value.VariantType.name

            return {
                "valid": True,
                "node_id": node_id,
                "value": clean_val,
                "datatype": dtype,
                "quality": "Good",
                "message": "Node verified successfully in Kepware OPC UA"
            }
    except Exception as err:
        return {
            "valid": False,
            "node_id": node_id,
            "message": f"Kepware node test failed: {str(err)}"
        }


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


@app.post("/api/gateway/explorer/write-node")
async def write_node(payload: WritePayload):
    # Enforce industrial read-only safety interlock for Process Variables (PV)
    meta = NODE_TO_TAG_META.get(payload.node_id)
    if meta and not meta.get("writable", True):
        raise HTTPException(
            status_code=403, 
            detail=f"WRITE REJECTED: Tag '{meta['tag_name']}' is a Read-Only Process Variable ({meta.get('role', 'PV')}). Writes are prohibited by ISA-88 interlock."
        )
    cached_tag = latest_cache["tags"].get(payload.node_id)
    if cached_tag and cached_tag.get("writable") is False:
        raise HTTPException(
            status_code=403,
            detail=f"WRITE REJECTED: Tag '{cached_tag.get('tag_name', payload.node_id)}' is marked Read-Only."
        )

    max_retries = 2
    for attempt in range(max_retries):
        try:
            client = await opc_mgr.get_active_client()
            async with opc_mgr.lock:
                node = client.get_node(payload.node_id)
                
                # Variant conversion
                dt = str(payload.data_type).strip() if payload.data_type else "Float"
                if dt in ["Float", "Single", "float", "single"]:
                    val = ua.Variant(float(payload.value), ua.VariantType.Float)
                elif dt in ["Int16", "Short", "int16", "short"]:
                    val = ua.Variant(int(float(payload.value)), ua.VariantType.Int16)
                elif dt in ["Boolean", "Bool", "bool", "boolean"]:
                    b_val = payload.value if isinstance(payload.value, bool) else (str(payload.value).strip().lower() in ("true", "1", "yes", "t"))
                    val = ua.Variant(b_val, ua.VariantType.Boolean)
                elif dt in ["Int", "Int32", "Integer", "int", "int32"]:
                    val = ua.Variant(int(float(payload.value)), ua.VariantType.Int32)
                elif dt in ["Double", "Float64", "double"]:
                    val = ua.Variant(float(payload.value), ua.VariantType.Double)
                else:
                    val = ua.Variant(str(payload.value), ua.VariantType.String)
                
                try:
                    await node.write_value(val)
                except Exception:
                    await node.write_value(ua.DataValue(val))

            # Update cache while preserving ISA-88 metadata
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            if payload.node_id in latest_cache["tags"]:
                latest_cache["tags"][payload.node_id]["value"] = payload.value
                latest_cache["tags"][payload.node_id]["quality"] = "Good"
                latest_cache["tags"][payload.node_id]["timestamp"] = now_str
            else:
                tag_name = meta["tag_name"] if meta else (payload.node_id.split(".")[-1] if "." in payload.node_id else payload.node_id)
                latest_cache["tags"][payload.node_id] = {
                    "tag_name": tag_name,
                    "node_id": payload.node_id,
                    "role": meta["role"] if meta else "Custom / Interactive",
                    "unit": meta["unit"] if meta else "--",
                    "writable": meta["writable"] if meta else True,
                    "description": meta["description"] if meta else f"Custom Node: {payload.node_id}",
                    "type": payload.data_type,
                    "data_type": payload.data_type,
                    "value": payload.value,
                    "quality": "Good",
                    "timestamp": now_str
                }

            # Synchronize line telemetry if command/state updated
            if meta:
                if meta["tag_name"] == "Batch_State":
                    gateway_state["telemetry"]["batch_status"] = str(payload.value)

            try:
                await connection_manager.broadcast({
                    "type": "TAG_UPDATE",
                    "data": latest_cache["tags"][payload.node_id]
                })
            except Exception:
                pass

            return {
                "status": "success",
                "written_value": payload.value,
                "value": payload.value,
                "node_id": payload.node_id,
                "timestamp": now_str
            }
        
        except Exception as e:
            logger.warning(f"Write operation failed on attempt {attempt + 1}/{max_retries}: {e}. Invalidating dead client...")
            # Invalidate dead client and force reconnect on next attempt
            opc_mgr.client = None
            opc_mgr.connected = False
            if attempt == max_retries - 1:
                raise HTTPException(status_code=500, detail=f"Write failed after retry: {str(e)}")
            await asyncio.sleep(0.5)

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
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
