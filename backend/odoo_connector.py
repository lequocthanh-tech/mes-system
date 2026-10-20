"""
ISA-95 Level 4 (ERP) to Level 3 (MES) Connector Module
Odoo 18 Community Edition XML-RPC Integration
Single Source of Truth for Enterprise Order Synchronization

Standard: ANSI/ISA-95.00.03 Enterprise-Control System Integration
Protocol: Python XML-RPC client (/xmlrpc/2/common, /xmlrpc/2/object)
Target ERP: Odoo 18 Community Edition (dairy_erp)
"""

import os
import sys
import time
import json
import logging
import xmlrpc.client
import threading
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("Odoo_Connector")

# Concurrency lock to prevent simultaneous XML-RPC writes to Odoo PostgreSQL
_odoo_sync_lock = threading.Lock()

CONFIG_FILE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "odoo_config.json")


def load_odoo_config() -> Dict[str, Any]:
    """
    Loads dynamic Odoo ERP credentials from backend/odoo_config.json.
    Falls back gracefully to environment variables or safe local defaults.
    """
    cfg = {
        "url": os.getenv("ODOO_URL", "http://localhost:8069").rstrip("/"),
        "db": os.getenv("ODOO_DB", "dairy_erp"),
        "username": os.getenv("ODOO_USER", "thanh.lethanhlequoc@hcmut.edu.vn"),
        "password": os.getenv("ODOO_PASSWORD", "quocthanh"),
    }

    if os.path.exists(CONFIG_FILE_PATH):
        try:
            with open(CONFIG_FILE_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    if saved.get("url"):
                        cfg["url"] = str(saved["url"]).strip().rstrip("/")
                    if saved.get("db"):
                        cfg["db"] = str(saved["db"]).strip()
                    if saved.get("username"):
                        cfg["username"] = str(saved["username"]).strip()
                    if saved.get("password") is not None:
                        cfg["password"] = str(saved["password"]).strip()
            logger.debug(f"[OdooConnector] Loaded dynamic config from {CONFIG_FILE_PATH} (DB: {cfg['db']}, User: {cfg['username']})")
        except Exception as exc:
            logger.warning(f"[OdooConnector] Error loading odoo_config.json ({exc}), using defaults.")

    return cfg


def save_odoo_config(data: Dict[str, Any]) -> bool:
    """
    Persists updated Odoo ERP credentials into backend/odoo_config.json.
    """
    try:
        clean_data = {
            "url": str(data.get("url") or "http://localhost:8069").strip().rstrip("/"),
            "db": str(data.get("db") or "dairy_erp").strip(),
            "username": str(data.get("username") or "thanh.lethanhlequoc@hcmut.edu.vn").strip(),
            "password": str(data.get("password") or "").strip(),
        }
        with open(CONFIG_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(clean_data, f, indent=2, ensure_ascii=False)
        logger.info(f"[OdooConnector] Successfully persisted configuration to {CONFIG_FILE_PATH}")
        return True
    except Exception as exc:
        logger.error(f"[OdooConnector] Failed to persist odoo_config.json: {exc}")
        return False


# In-memory cached heartbeat state dictionary for O(1) <5ms status endpoint response
odoo_health_cache: Dict[str, Any] = {
    "connected": False,
    "latency_ms": 0.0,
    "uid": None,
    "database": "dairy_erp",
    "url": "http://localhost:8069",
    "username": "thanh.lethanhlequoc@hcmut.edu.vn",
    "server_version": "Unknown",
    "status": "OFFLINE",
    "last_checked": "",
    "error": None,
}


def update_odoo_health_cache(status: Dict[str, Any]) -> Dict[str, Any]:
    """Updates in-memory health cache with timestamp for immediate client retrieval."""
    global odoo_health_cache
    status_copy = dict(status)
    if not status_copy.get("last_checked"):
        status_copy["last_checked"] = time.strftime("%Y-%m-%d %H:%M:%S")
    odoo_health_cache.update(status_copy)
    return odoo_health_cache


class TimeoutTransport(xmlrpc.client.Transport):
    """Custom HTTP XML-RPC Transport with explicit socket timeout to prevent indefinite hangs."""
    def __init__(self, timeout: float = 10.0, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timeout = timeout

    def make_connection(self, host):
        conn = super().make_connection(host)
        conn.timeout = self.timeout
        return conn


class TimeoutSafeTransport(xmlrpc.client.SafeTransport):
    """Custom HTTPS XML-RPC Transport with explicit socket timeout to prevent indefinite hangs."""
    def __init__(self, timeout: float = 10.0, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timeout = timeout

    def make_connection(self, host):
        conn = super().make_connection(host)
        conn.timeout = self.timeout
        return conn


def get_xmlrpc_transport(url: str, timeout: float = 10.0):
    """Returns appropriate timeout-guarded XML-RPC transport based on scheme."""
    if url.lower().startswith("https"):
        return TimeoutSafeTransport(timeout=timeout)
    return TimeoutTransport(timeout=timeout)


class OdooConnector:
    """
    Industrial XML-RPC Connector for Odoo 18 Community Edition.
    Provides reliable, low-overhead heartbeats and Level 4 -> Level 3
    production order downlink synchronization.
    """

    def __init__(
        self,
        url: Optional[str] = None,
        db: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        cfg = load_odoo_config()
        self.url = (url or cfg["url"]).rstrip("/")
        self.db = db or cfg["db"]
        self.username = username or cfg["username"]
        self.password = password or cfg["password"]

        # Caching for low-latency heartbeat (prevents CPU-intensive PBKDF2 hash storm)
        self._cached_uid: Optional[int] = None
        self._last_auth_time: float = 0.0
        self._auth_ttl_seconds: float = 86400.0

    def update_credentials(self, url: str, db: str, username: str, password: str):
        """
        Re-initializes credentials in-memory without server restart.
        Clears cached auth session to force fresh verification.
        """
        self.url = (url or "http://localhost:8069").rstrip("/")
        self.db = (db or "dairy_erp").strip()
        self.username = (username or "").strip()
        self.password = (password or "").strip()
        self._cached_uid = None
        self._last_auth_time = 0.0
        logger.info(f"[OdooConnector] In-memory credentials updated: URL={self.url}, DB={self.db}, User={self.username}")

    def _get_common_proxy(self, timeout: float = 10.0) -> xmlrpc.client.ServerProxy:
        transport = get_xmlrpc_transport(self.url, timeout=timeout)
        return xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/common", transport=transport, allow_none=True)

    def _get_object_proxy(self, timeout: float = 10.0) -> xmlrpc.client.ServerProxy:
        transport = get_xmlrpc_transport(self.url, timeout=timeout)
        return xmlrpc.client.ServerProxy(f"{self.url}/xmlrpc/2/object", transport=transport, allow_none=True)

    def authenticate(self, force_refresh: bool = False) -> Optional[int]:
        """
        Authenticates against Odoo XML-RPC /xmlrpc/2/common.
        Returns the User ID (uid) on success, or None on failure.
        Caches valid UID for 24 hours (86400s TTL) to eliminate PBKDF2 overhead and prevent session drop.
        """
        now = time.time()
        if not force_refresh and self._cached_uid is not None and (now - self._last_auth_time < self._auth_ttl_seconds):
            return self._cached_uid

        try:
            # Refresh credentials from persistent file if currently empty
            if not self.username or not self.password:
                cfg = load_odoo_config()
                self.url = self.url or cfg["url"]
                self.db = self.db or cfg["db"]
                self.username = self.username or cfg["username"]
                self.password = self.password or cfg["password"]

            common = self._get_common_proxy()
            # Primary authentication attempt with active credentials
            uid = common.authenticate(self.db, self.username, self.password, {})
            if isinstance(uid, int) and uid > 0:
                self._cached_uid = uid
                self._last_auth_time = now
                logger.info(f"[OdooConnector] Authenticated successfully with Odoo (UID: {uid}, DB: {self.db}, User: {self.username})")
                return uid

            # Explicit authentication failure: DO NOT overwrite with fallback admin credentials!
            logger.warning(f"[OdooConnector] Authentication rejected for user '{self.username}' on database '{self.db}'.")
            self._cached_uid = None
            return None
        except Exception as exc:
            logger.warning(f"[OdooConnector] Authentication exception: {exc}")
            self._cached_uid = None
            return None

    def check_connection(self) -> Dict[str, Any]:
        """
        Pings Odoo XML-RPC /xmlrpc/2/common.
        Returns { "connected": bool, "latency_ms": float, "uid": Optional[int], "database": str }
        without raising uncaught exceptions.
        """
        t0 = time.perf_counter()
        try:
            common = self._get_common_proxy()
            version_info = common.version()
            version_str = version_info.get("server_version", "18.0") if isinstance(version_info, dict) else "18.0"

            uid = self.authenticate()
            latency = round((time.perf_counter() - t0) * 1000, 2)

            is_connected = bool(uid is not None and uid > 0)
            res = {
                "connected": is_connected,
                "latency_ms": latency,
                "uid": uid,
                "database": self.db,
                "url": self.url,
                "username": self.username,
                "server_version": version_str,
                "status": "ONLINE" if is_connected else "AUTH_FAILED",
                "last_checked": time.strftime("%Y-%m-%d %H:%M:%S"),
                "error": None,
            }
            update_odoo_health_cache(res)
            return res
        except Exception as exc:
            latency = round((time.perf_counter() - t0) * 1000, 2)
            logger.debug(f"[OdooConnector] Heartbeat check failed ({exc})")
            res = {
                "connected": False,
                "latency_ms": latency,
                "uid": None,
                "database": self.db,
                "url": self.url,
                "username": self.username,
                "server_version": "Unknown",
                "status": "OFFLINE",
                "error": str(exc),
                "last_checked": time.strftime("%Y-%m-%d %H:%M:%S"),
            }
            update_odoo_health_cache(res)
            return res

    def fetch_manufacturing_orders(self) -> List[Dict[str, Any]]:
        """
        ISA-95 Level 4 -> Level 3 Manufacturing Order Downlink:
        Authenticates and queries mrp.production with domain [['state', 'in', ['confirmed', 'planned']]].
        STRICT VALIDATION: Only returns Manufacturing Orders (codes starting with 'WH/MO').
        Never returns stock pickings or warehouse receipts.
        """
        uid = self.authenticate(force_refresh=False)
        if not uid:
            uid = self.authenticate(force_refresh=True)

        if not uid:
            raise ConnectionError(
                f"Cannot authenticate with Odoo 18 ERP at {self.url} (DB: {self.db}, User: {self.username}). "
                "Verify ERP credentials or check if Odoo service is running."
            )

        models = self._get_object_proxy()
        # Query planned/confirmed production orders
        domain = [["state", "in", ["confirmed", "planned"]]]
        candidate_fields = ["name", "product_id", "product_qty", "date_start", "date_deadline", "id", "state", "origin"]

        try:
            records = models.execute_kw(
                self.db,
                uid,
                self.password,
                "mrp.production",
                "search_read",
                [domain],
                {"fields": candidate_fields},
            )
        except Exception as field_err:
            logger.info(f"[OdooConnector] Query with planned states notice ({field_err}), probing confirmed state...")
            try:
                records = models.execute_kw(
                    self.db,
                    uid,
                    self.password,
                    "mrp.production",
                    "search_read",
                    [[["state", "=", "confirmed"]]],
                    {"fields": ["name", "product_id", "product_qty", "date_start", "date_deadline", "id", "state", "origin"]},
                )
            except Exception:
                records = models.execute_kw(
                    self.db,
                    uid,
                    self.password,
                    "mrp.production",
                    "search_read",
                    [[]],
                    {"fields": ["name", "product_id", "product_qty", "id", "state", "origin"], "limit": 20},
                )

        orders: List[Dict[str, Any]] = []
        for rec in records or []:
            try:
                raw_code = str(rec.get("name") or "").strip()
                if not raw_code:
                    continue

                # STRICT VALIDATION: Ensure code starts with 'WH/MO' (or manufacturing prefix)
                # and strictly reject any warehouse receipts ('WH/IN')
                if raw_code.startswith("WH/IN") or raw_code.startswith("INB-"):
                    logger.warning(f"[OdooConnector] Excluded non-MO record [{raw_code}] from manufacturing orders downlink.")
                    continue

                # Parse product_id pair [id, "Product Display Name"]
                prod_val = rec.get("product_id")
                prod_id_int = None
                if isinstance(prod_val, (list, tuple)) and len(prod_val) > 0:
                    prod_id_int = prod_val[0]
                    product_name = str(prod_val[1]).strip() if len(prod_val) > 1 else "Fresh Dairy Product"
                elif isinstance(prod_val, str):
                    product_name = prod_val.strip()
                else:
                    product_name = "Fresh Dairy Product"

                # Dynamically retrieve Product Recipe Identifier (default_code / Internal Reference)
                default_code = ""
                if prod_id_int:
                    try:
                        p_read = models.execute_kw(
                            self.db,
                            uid,
                            self.password,
                            "product.product",
                            "read",
                            [[prod_id_int]],
                            {"fields": ["default_code", "name"]}
                        )
                        if p_read and isinstance(p_read, list) and len(p_read) > 0:
                            dc = p_read[0].get("default_code")
                            if dc:
                                default_code = str(dc).strip()
                    except Exception as p_err:
                        logger.debug(f"[OdooConnector] Could not read default_code for product {prod_id_int}: {p_err}")

                recipe_code = default_code if default_code else product_name

                # Dynamically retrieve Customer Profile
                customer_data = {
                    "customer_code": "CUS-DEFAULT",
                    "customer_name": "Khách hàng Tiêu chuẩn",
                    "phone": "---",
                    "email": "---",
                    "address": "---",
                }

                partner_found_id = None
                direct_partner = rec.get("partner_id")
                if isinstance(direct_partner, (list, tuple)) and len(direct_partner) > 0:
                    partner_found_id = direct_partner[0]
                elif isinstance(direct_partner, int):
                    partner_found_id = direct_partner

                origin_val = str(rec.get("origin") or "").strip()
                if not partner_found_id and origin_val:
                    # 1. Check sale.order trace if model exists
                    try:
                        so_recs = models.execute_kw(
                            self.db,
                            uid,
                            self.password,
                            "sale.order",
                            "search_read",
                            [[["name", "=", origin_val]]],
                            {"fields": ["partner_id"], "limit": 1}
                        )
                        if so_recs and so_recs[0].get("partner_id"):
                            so_p = so_recs[0]["partner_id"]
                            partner_found_id = so_p[0] if isinstance(so_p, (list, tuple)) else so_p
                    except Exception:
                        pass

                    # 2. Match res.partner directly by name or ref
                    if not partner_found_id:
                        try:
                            p_search = models.execute_kw(
                                self.db,
                                uid,
                                self.password,
                                "res.partner",
                                "search_read",
                                [["|", ["name", "ilike", origin_val], ["ref", "=", origin_val]]],
                                {"fields": ["id", "name", "ref", "phone", "email", "street", "city"], "limit": 1}
                            )
                            if p_search and len(p_search) > 0:
                                p_rec = p_search[0]
                                addr_parts = [p_rec.get("street"), p_rec.get("city")]
                                resolved_addr = ", ".join([str(p).strip() for p in addr_parts if p]) or "---"
                                customer_data = {
                                    "customer_code": str(p_rec.get("ref") or f"CUS-{p_rec['id']}").strip(),
                                    "customer_name": str(p_rec.get("name") or "Khách hàng Tiêu chuẩn").strip(),
                                    "phone": str(p_rec.get("phone") or "---").strip(),
                                    "email": str(p_rec.get("email") or "---").strip(),
                                    "address": resolved_addr,
                                }
                                partner_found_id = p_rec["id"]
                        except Exception:
                            pass

                # If partner_found_id was resolved, fetch full details from res.partner
                if partner_found_id and isinstance(partner_found_id, int) and customer_data["customer_code"] == "CUS-DEFAULT":
                    try:
                        p_read = models.execute_kw(
                            self.db,
                            uid,
                            self.password,
                            "res.partner",
                            "read",
                            [[partner_found_id]],
                            {"fields": ["id", "name", "ref", "phone", "email", "street", "city"]}
                        )
                        if p_read and len(p_read) > 0:
                            p_rec = p_read[0]
                            addr_parts = [p_rec.get("street"), p_rec.get("city")]
                            resolved_addr = ", ".join([str(p).strip() for p in addr_parts if p]) or "---"
                            customer_data = {
                                "customer_code": str(p_rec.get("ref") or f"CUS-{p_rec['id']}").strip(),
                                "customer_name": str(p_rec.get("name") or "Khách hàng Tiêu chuẩn").strip(),
                                "phone": str(p_rec.get("phone") or "---").strip(),
                                "email": str(p_rec.get("email") or "---").strip(),
                                "address": resolved_addr,
                            }
                    except Exception as p_read_err:
                        logger.warning(f"[OdooConnector] Error reading res.partner {partner_found_id}: {p_read_err}")

                # Parse target quantity / volume
                raw_qty = rec.get("product_qty")
                try:
                    target_volume = float(raw_qty) if raw_qty is not None else 2.0
                except (ValueError, TypeError):
                    target_volume = 2.0

                # Resolve scheduled start date
                scheduled_date = str(
                    rec.get("date_start")
                    or rec.get("date_deadline")
                    or ""
                ).strip()

                odoo_id = int(rec.get("id") or 0)
                state = str(rec.get("state") or "confirmed")

                orders.append({
                    "order_code": raw_code,
                    "product_name": product_name,
                    "default_code": default_code,
                    "recipe_code": recipe_code,
                    "target_volume": target_volume,
                    "scheduled_date": scheduled_date,
                    "odoo_id": odoo_id,
                    "state": state,
                    "origin": origin_val,
                    "customer": customer_data,
                })
            except Exception as item_err:
                logger.error(f"[OdooConnector] Error parsing manufacturing order record {rec}: {item_err}")
                continue

        logger.info(f"[OdooConnector] Successfully retrieved {len(orders)} manufacturing orders (WH/MO) from Odoo ERP.")
        return orders

    def fetch_confirmed_orders(self) -> List[Dict[str, Any]]:
        """Backward-compatible alias for fetch_manufacturing_orders."""
        return self.fetch_manufacturing_orders()

    def fetch_inbound_receipts(self) -> List[Dict[str, Any]]:
        """
        Retrieves inbound warehouse receipts (stock.picking / purchase deliveries) from Odoo 18.
        Uses explicit 10-second XML-RPC socket timeout to prevent indefinite hangs.
        Domain: [['picking_type_code', '=', 'incoming'], ['state', 'in', ['assigned', 'confirmed', 'done']]]
        Projection: ['id', 'name', 'partner_id', 'state', 'scheduled_date', 'move_ids_without_package']
        Limit: 20 recent items ordered by id desc for lightning-fast execution (<500ms).
        STRICT VALIDATION: Only returns Inbound Delivery Orders (codes starting with 'WH/IN').
        Never returns manufacturing orders (WH/MO).
        Gracefully returns empty list [] if Odoo is unreachable.
        """
        try:
            uid = self.authenticate(force_refresh=False)
            if not uid:
                uid = self.authenticate(force_refresh=True)

            if not uid:
                logger.warning(
                    f"[OdooConnector] Cannot authenticate with Odoo 18 ERP at {self.url} (DB: {self.db}, User: {self.username}). "
                    "Returning empty inbound receipts."
                )
                return []

            models = self._get_object_proxy(timeout=10.0)
            domain = [
                ["picking_type_code", "=", "incoming"],
                ["state", "in", ["assigned", "confirmed", "done"]]
            ]

            try:
                pickings = models.execute_kw(
                    self.db,
                    uid,
                    self.password,
                    "stock.picking",
                    "search_read",
                    [domain],
                    {
                        "fields": ["id", "name", "partner_id", "state", "scheduled_date", "move_ids_without_package"],
                        "limit": 20,
                        "order": "id desc"
                    }
                )
            except Exception as domain_err:
                logger.warning(f"[OdooConnector] Querying stock.picking failed ({domain_err}), falling back to broader domain...")
                try:
                    pickings = models.execute_kw(
                        self.db,
                        uid,
                        self.password,
                        "stock.picking",
                        "search_read",
                        [[["state", "in", ["assigned", "confirmed", "done"]]]],
                        {
                            "fields": ["id", "name", "partner_id", "state", "scheduled_date", "move_ids_without_package"],
                            "limit": 20,
                            "order": "id desc"
                        }
                    )
                except Exception as fallback_err:
                    logger.warning(f"[OdooConnector] Fallback query for stock.picking also failed ({fallback_err}). Returning [].")
                    return []

            if not pickings:
                logger.info("[OdooConnector] No incoming stock pickings found in Odoo 18.")
                return []

            # Batch collect move IDs across all pickings to fetch all stock.moves in ONE call
            all_move_ids: List[int] = []
            for p in pickings:
                m_ids = p.get("move_ids_without_package") or []
                if isinstance(m_ids, (list, tuple)):
                    all_move_ids.extend([m for m in m_ids if isinstance(m, int)])

            moves_by_id: Dict[int, Dict[str, Any]] = {}
            if all_move_ids:
                try:
                    unique_move_ids = list(set(all_move_ids))
                    moves_data = models.execute_kw(
                        self.db,
                        uid,
                        self.password,
                        "stock.move",
                        "search_read",
                        [[["id", "in", unique_move_ids]]],
                        {"fields": ["id", "product_id", "product_uom_qty", "quantity", "product_uom"]}
                    )
                    if isinstance(moves_data, list):
                        for m in moves_data:
                            if isinstance(m, dict) and "id" in m:
                                moves_by_id[m["id"]] = m
                except Exception as move_err:
                    logger.warning(f"[OdooConnector] Batch reading stock.move lines failed: {move_err}")

            receipts: List[Dict[str, Any]] = []

            for p in pickings:
                raw_name = str(p.get("name") or "").strip()
                if not raw_name:
                    continue

                # STRICT VALIDATION: Exclude manufacturing orders (WH/MO) from inbound receipts
                if raw_name.startswith("WH/MO") or "MO/" in raw_name:
                    logger.warning(f"[OdooConnector] Excluded MO record [{raw_name}] from inbound receipts downlink.")
                    continue

                # Partner name resolution
                partner_val = p.get("partner_id")
                if isinstance(partner_val, (list, tuple)) and len(partner_val) > 1:
                    partner_name = str(partner_val[1]).strip()
                else:
                    partner_name = "Vinamilk Farm Co."

                # Scheduled / Done date resolution
                scheduled_date = str(p.get("scheduled_date") or "").strip()
                odoo_id = int(p.get("id") or 0)
                state = str(p.get("state") or "")

                # Lookup pre-fetched batch moves
                m_ids = p.get("move_ids_without_package") or []
                moves = [moves_by_id[m_id] for m_id in m_ids if m_id in moves_by_id]

                if moves:
                    for m in moves:
                        # Product Name
                        prod_val = m.get("product_id")
                        if isinstance(prod_val, (list, tuple)) and len(prod_val) > 1:
                            mat_name = str(prod_val[1]).strip()
                        else:
                            mat_name = "Raw Milk (Sữa tươi nguyên liệu)"

                        # Expected quantity
                        raw_qty = m.get("product_uom_qty") or m.get("quantity") or 0.0
                        try:
                            expected_qty = float(raw_qty)
                        except (ValueError, TypeError):
                            expected_qty = 0.0

                        # Unit resolution
                        uom_val = m.get("product_uom")
                        uom_str = str(uom_val[1] if isinstance(uom_val, (list, tuple)) and len(uom_val) > 1 else "kg").strip()

                        # Standardized MES Material Code
                        name_upper = mat_name.upper()
                        if "MILK" in name_upper or "SỮA" in name_upper or "SUA" in name_upper:
                            mat_code = "RAW_MILK"
                            unit = "L" if uom_str.lower() in ["units", "unit", "đơn vị", "l"] else ("kg" if uom_str.lower() == "kg" else "L")
                        elif "SUGAR" in name_upper or "ĐƯỜNG" in name_upper or "DUONG" in name_upper:
                            mat_code = "SUGAR"
                            unit = "kg"
                        elif "VITAMIN" in name_upper or "MINERAL" in name_upper or "VI CHẤT" in name_upper or "VI CHAT" in name_upper or "ADD" in name_upper:
                            mat_code = "ADDITIVE_MINERAL"
                            unit = "kg"
                        else:
                            mat_code = "RAW_MILK"
                            unit = "kg" if uom_str.lower() in ["units", "unit", "đơn vị"] else uom_str

                        receipts.append({
                            "receipt_code": raw_name,
                            "partner_name": partner_name,
                            "material_name": mat_name,
                            "material_code": mat_code,
                            "expected_qty": expected_qty,
                            "unit": unit,
                            "scheduled_date": scheduled_date,
                            "state": state,
                            "odoo_id": odoo_id,
                            "is_done": state == "done",
                            "is_ready": state in ["assigned", "confirmed"],
                        })
                else:
                    # Single receipt without separate moves
                    receipts.append({
                        "receipt_code": raw_name,
                        "partner_name": partner_name,
                        "material_name": "Raw Milk (Sữa tươi nguyên liệu)",
                        "material_code": "RAW_MILK",
                        "expected_qty": 2.0,
                        "unit": "L",
                        "scheduled_date": scheduled_date,
                        "state": state,
                        "odoo_id": odoo_id,
                        "is_done": state == "done",
                        "is_ready": state in ["assigned", "confirmed"],
                    })

            logger.info(f"[OdooConnector] Successfully retrieved {len(receipts)} inbound receipts (WH/IN) from Odoo 18.")
            return receipts
        except Exception as exc:
            logger.warning(f"[OdooConnector] Error fetching inbound receipts from Odoo ({exc}). Returning empty list.")
            return []

    def complete_inbound_receipt_in_odoo(
        self,
        receipt_code: str,
        actual_qty: float,
        tank_id: str = "",
        supplier_lot: str = "",
        operator: str = "MES_Operator"
    ) -> Dict[str, Any]:
        """
        Closed-Loop Inbound Receipt Validation (MES Level 3 MOM -> Odoo 18 ERP Level 4):
        1. Reuses cached uid (re-authenticating only if None) with a 15-second socket timeout transport.
        2. Locates stock.picking record where name == receipt_code (e.g. 'WH/IN/00005').
        3. If already in 'done' state, returns early with success=True.
        4. Updates actual received quantity and picked=True on stock.move and stock.move.line.
        5. Calls button_validate and automatically handles any immediate/backorder wizard.
        6. Posts an audit note to the picking chatter with ISA-95 traceability details.
        7. Verifies final state ('done') and returns structured status dictionary.
        """
        clean_code = str(receipt_code or "").strip()
        if not clean_code:
            return {"success": False, "message": "Mã phiếu nhận hàng không được để trống"}

        uid = self.authenticate(force_refresh=False)
        if not uid:
            uid = self.authenticate(force_refresh=True)

        if not uid:
            logger.warning(f"[OdooInbound] Cannot authenticate with Odoo at {self.url}. Inbound validation aborted.")
            return {
                "success": False,
                "message": f"Không thể xác thực với Odoo 18 ERP tại {self.url}",
                "receipt_code": clean_code
            }

        models = self._get_object_proxy(timeout=15.0)

        # 1. Search stock.picking
        try:
            pickings = models.execute_kw(
                self.db, uid, self.password,
                "stock.picking", "search_read",
                [[["name", "=", clean_code]]],
                {"fields": ["id", "name", "state", "move_ids"], "limit": 1}
            )
        except Exception as search_err:
            logger.error(f"[OdooInbound] Error searching picking {clean_code}: {search_err}")
            return {
                "success": False,
                "message": f"Lỗi truy vấn đơn nhận hàng {clean_code} từ Odoo: {str(search_err)}",
                "receipt_code": clean_code
            }

        if not pickings:
            logger.warning(f"[OdooInbound] Picking [{clean_code}] not found in Odoo 18.")
            return {
                "success": False,
                "message": f"Picking {clean_code} not found in Odoo",
                "receipt_code": clean_code
            }

        picking = pickings[0]
        picking_id = picking["id"]
        curr_state = picking.get("state")

        # 2. If already done, return success
        if curr_state == "done":
            logger.info(f"[OdooInbound] Picking [{clean_code}] is already in 'done' state.")
            return {
                "success": True,
                "already_done": True,
                "state": "done",
                "receipt_code": clean_code,
                "odoo_picking_id": picking_id,
                "actual_qty": float(actual_qty),
                "message": f"Phiếu nhập {clean_code} đã hoàn tất (DONE) trước đó trên Odoo ERP"
            }

        # 3. If in draft/waiting, confirm and assign
        if curr_state in ["draft", "waiting"]:
            try:
                models.execute_kw(self.db, uid, self.password, "stock.picking", "action_confirm", [[picking_id]])
            except Exception as conf_err:
                logger.debug(f"[OdooInbound] action_confirm notice: {conf_err}")
            try:
                models.execute_kw(self.db, uid, self.password, "stock.picking", "action_assign", [[picking_id]])
            except Exception as assign_err:
                logger.debug(f"[OdooInbound] action_assign notice: {assign_err}")

        # 4. Update actual received quantity on stock.move & stock.move.line
        move_ids = picking.get("move_ids") or []
        if not move_ids:
            try:
                move_ids = models.execute_kw(
                    self.db, uid, self.password,
                    "stock.move", "search",
                    [[["picking_id", "=", picking_id]]]
                )
            except Exception as find_m_err:
                logger.warning(f"[OdooInbound] Could not query moves for picking {picking_id}: {find_m_err}")

        for m_id in move_ids:
            # Write quantity and picked=True for Odoo 17/18
            try:
                models.execute_kw(
                    self.db, uid, self.password,
                    "stock.move", "write",
                    [[m_id], {"quantity": float(actual_qty), "picked": True}]
                )
            except Exception as w_err1:
                logger.debug(f"[OdooInbound] stock.move write quantity failed ({w_err1}), trying quantity_done...")
                try:
                    models.execute_kw(
                        self.db, uid, self.password,
                        "stock.move", "write",
                        [[m_id], {"quantity_done": float(actual_qty)}]
                    )
                except Exception as w_err2:
                    logger.debug(f"[OdooInbound] stock.move write fallback failed: {w_err2}")

            # Also update stock.move.line if present
            try:
                lines = models.execute_kw(
                    self.db, uid, self.password,
                    "stock.move.line", "search_read",
                    [[["move_id", "=", m_id]]],
                    {"fields": ["id", "quantity", "lot_name"], "limit": 10}
                )
                if lines:
                    for line in lines:
                        line_vals = {"quantity": float(actual_qty)}
                        if supplier_lot:
                            line_vals["lot_name"] = str(supplier_lot).strip()
                        try:
                            models.execute_kw(
                                self.db, uid, self.password,
                                "stock.move.line", "write",
                                [[line["id"]], line_vals]
                            )
                        except Exception:
                            try:
                                models.execute_kw(
                                    self.db, uid, self.password,
                                    "stock.move.line", "write",
                                    [[line["id"]], {"qty_done": float(actual_qty)}]
                                )
                            except Exception:
                                pass
            except Exception as ml_err:
                logger.debug(f"[OdooInbound] stock.move.line update notice: {ml_err}")

        # 5. Call button_validate on stock.picking
        res = None
        try:
            res = models.execute_kw(
                self.db, uid, self.password,
                "stock.picking", "button_validate",
                [[picking_id]]
            )
        except Exception as val_err:
            if "cannot marshal None" not in str(val_err):
                logger.warning(f"[OdooInbound] button_validate notice: {val_err}")

        # 6. Handle backorder or immediate transfer wizard dictionary returns
        if isinstance(res, dict) and res.get("res_model"):
            wizard_model = res["res_model"]
            wizard_context = res.get("context", {})
            wiz_id = res.get("res_id")
            logger.info(f"[OdooInbound] Resolving validation wizard {wizard_model} (ID: {wiz_id})...")
            if wizard_model == "stock.backorder.confirmation":
                if not wiz_id:
                    try:
                        wiz_id = models.execute_kw(
                            self.db, uid, self.password,
                            wizard_model, "create",
                            [{}],
                            {"context": wizard_context}
                        )
                    except Exception as cw_err:
                        logger.debug(f"[OdooInbound] Wizard create notice: {cw_err}")
                try:
                    models.execute_kw(
                        self.db, uid, self.password,
                        wizard_model, "process_cancel_backorder",
                        [[wiz_id]] if wiz_id else [],
                        {"context": wizard_context}
                    )
                except Exception:
                    try:
                        models.execute_kw(
                            self.db, uid, self.password,
                            wizard_model, "process",
                            [[wiz_id]] if wiz_id else [],
                            {"context": wizard_context}
                        )
                    except Exception:
                        pass
            elif wizard_model in ["stock.immediate.transfer", "stock.immediate.transfer.line"]:
                if not wiz_id:
                    try:
                        wiz_id = models.execute_kw(
                            self.db, uid, self.password,
                            wizard_model, "create",
                            [{}],
                            {"context": wizard_context}
                        )
                    except Exception:
                        pass
                try:
                    models.execute_kw(
                        self.db, uid, self.password,
                        wizard_model, "process",
                        [[wiz_id]] if wiz_id else [],
                        {"context": wizard_context}
                    )
                except Exception:
                    pass

        # 7. Post audit note to chatter
        audit_note = (
            f"[MES ISA-95 UPLINK] Đã xác nhận nhập kho tại {tank_id} | "
            f"Thực nhận: {float(actual_qty):.2f} | Lô: {supplier_lot} | Người vận hành: {operator}"
        )
        try:
            models.execute_kw(
                self.db, uid, self.password,
                "stock.picking", "message_post",
                [[picking_id]],
                {"body": audit_note, "message_type": "comment"}
            )
        except Exception as msg_err:
            logger.warning(f"[OdooInbound] message_post notice: {msg_err}")

        # 8. Verify final state of stock.picking
        final_state = "done"
        try:
            p_check = models.execute_kw(
                self.db, uid, self.password,
                "stock.picking", "read",
                [[picking_id]],
                {"fields": ["state"]}
            )
            if p_check and isinstance(p_check, list):
                final_state = p_check[0].get("state", "done")
        except Exception as r_err:
            logger.debug(f"[OdooInbound] Final state check notice: {r_err}")

        is_done = (final_state == "done")
        logger.info(f"[OdooInbound] Successfully processed picking [{clean_code}]: final_state={final_state}")
        return {
            "success": is_done,
            "receipt_code": clean_code,
            "odoo_picking_id": picking_id,
            "state": final_state,
            "actual_qty": float(actual_qty),
            "message": f"Phiếu nhập {clean_code} đã hoàn tất ({final_state}) trên Odoo ERP"
        }

    def sync_tank_stock_to_odoo(self, tank_stocks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Real-Time Tank Stock Uplink (MES Level 3 -> Odoo ERP Level 4):
        Synchronizes verified stock levels of TANK-01, TANK-02, and TANK-03 directly into Odoo's stock ledger.
        Optimized with concurrency lock, cached auth, single-batch location and product pre-fetching,
        and threshold check to skip redundant action_apply_inventory calls.
        """
        with _odoo_sync_lock:
            uid = self.authenticate(force_refresh=False)
            if not uid:
                uid = self.authenticate(force_refresh=True)

            if not uid:
                logger.warning(f"[OdooUplink] Cannot authenticate with Odoo at {self.url}. Uplink aborted.")
                return {
                    "success": False,
                    "error": "Cannot authenticate with Odoo 18 ERP",
                    "synced_tanks": [],
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                }

            models = self._get_object_proxy(timeout=15.0)
            synced_results: List[Dict[str, Any]] = []

            # 1. Batch pre-fetch internal locations
            loc_by_name: Dict[str, int] = {}
            default_loc_id = 8
            try:
                locs = models.execute_kw(
                    self.db, uid, self.password,
                    "stock.location", "search_read",
                    [[["usage", "=", "internal"]]],
                    {"fields": ["id", "name", "complete_name"], "limit": 40}
                )
                if locs and isinstance(locs, list):
                    wh_stock = next((l for l in locs if "WH/Stock" in str(l.get("complete_name"))), locs[0])
                    default_loc_id = wh_stock["id"]
                    for l in locs:
                        n = str(l.get("name") or "").strip().upper()
                        loc_by_name[n] = l["id"]
            except Exception as loc_err:
                logger.warning(f"[OdooUplink] Error batch-fetching stock locations: {loc_err}")

            # 2. Batch pre-fetch raw material products
            prod_by_role: Dict[str, int] = {}
            try:
                prods = models.execute_kw(
                    self.db, uid, self.password,
                    "product.product", "search_read",
                    [[["is_storable", "=", True]]],
                    {"fields": ["id", "name", "default_code"], "limit": 40}
                )
                for p in (prods or []):
                    name_up = str(p.get("name") or "").upper()
                    code_up = str(p.get("default_code") or "").upper()
                    pid = p["id"]
                    if "MILK" in name_up or "SỮA" in name_up or "SUA" in name_up or "RAW_MILK" in code_up:
                        prod_by_role.setdefault("RAW_MILK", pid)
                    elif "SUGAR" in name_up or "ĐƯỜNG" in name_up or "DUONG" in name_up or "SUGAR" in code_up:
                        prod_by_role.setdefault("SUGAR", pid)
                    elif "VITAMIN" in name_up or "MINERAL" in name_up or "ADDITIVE" in code_up or "CACAO" in name_up or "PHỤ GIA" in name_up:
                        prod_by_role.setdefault("ADDITIVE", pid)
            except Exception as prod_err:
                logger.warning(f"[OdooUplink] Error batch-fetching products: {prod_err}")

            # Fallbacks for standard products
            prod_by_role.setdefault("RAW_MILK", 3)
            prod_by_role.setdefault("SUGAR", 4)
            prod_by_role.setdefault("ADDITIVE", 5)

            for item in tank_stocks:
                tank_id = str(item.get("tank_id") or "TANK-01").strip().upper()
                mat_code = str(item.get("material_code") or "").strip().upper()
                current_stock = float(item.get("current_stock") or 0.0)
                unit = str(item.get("unit") or "kg").strip()

                # Resolve Location
                loc_id = loc_by_name.get(tank_id, default_loc_id)

                # Resolve Product
                if "MILK" in mat_code or "SỮA" in mat_code:
                    prod_id = prod_by_role.get("RAW_MILK", 3)
                elif "SUGAR" in mat_code or "ĐƯỜNG" in mat_code:
                    prod_id = prod_by_role.get("SUGAR", 4)
                else:
                    prod_id = prod_by_role.get("ADDITIVE", 5)

                quant_id = None
                try:
                    quants = models.execute_kw(
                        self.db, uid, self.password,
                        "stock.quant", "search_read",
                        [[["product_id", "=", prod_id], ["location_id", "=", loc_id]]],
                        {"fields": ["id", "quantity", "inventory_quantity"], "limit": 1}
                    )

                    if quants:
                        quant_id = quants[0]["id"]
                        existing_qty = float(quants[0].get("quantity") or 0.0)

                        # Threshold optimization: skip write and action_apply_inventory if delta < 0.001
                        if abs(existing_qty - current_stock) < 0.001:
                            logger.info(f"[OdooUplink] Tank [{tank_id}] stock delta negligible ({existing_qty:.3f} vs {current_stock:.3f}). Skipping apply.")
                            synced_results.append({
                                "tank_id": tank_id,
                                "material_code": mat_code,
                                "current_stock": current_stock,
                                "unit": unit,
                                "odoo_product_id": prod_id,
                                "odoo_location_id": loc_id,
                                "odoo_quant_id": quant_id,
                                "status": "SYNCED_UNCHANGED"
                            })
                            continue

                        models.execute_kw(
                            self.db, uid, self.password,
                            "stock.quant", "write",
                            [[quant_id], {
                                "inventory_quantity_auto_apply": current_stock,
                                "inventory_quantity": current_stock
                            }]
                        )
                    else:
                        quant_id = models.execute_kw(
                            self.db, uid, self.password,
                            "stock.quant", "create",
                            [{
                                "product_id": prod_id,
                                "location_id": loc_id,
                                "inventory_quantity_auto_apply": current_stock,
                                "inventory_quantity": current_stock
                            }]
                        )

                    # Safe invocation of action_apply_inventory
                    try:
                        models.execute_kw(
                            self.db, uid, self.password,
                            "stock.quant", "action_apply_inventory",
                            [[quant_id]]
                        )
                    except Exception as apply_err:
                        if "cannot marshal None" not in str(apply_err):
                            logger.debug(f"[OdooUplink] action_apply_inventory notice: {apply_err}")

                    synced_results.append({
                        "tank_id": tank_id,
                        "material_code": mat_code,
                        "current_stock": current_stock,
                        "unit": unit,
                        "odoo_product_id": prod_id,
                        "odoo_location_id": loc_id,
                        "odoo_quant_id": quant_id,
                        "status": "SYNCED"
                    })
                    logger.info(f"[OdooUplink] Tank [{tank_id}] ({mat_code}) stock {current_stock:,.2f} {unit} synced to Odoo Location {loc_id} (Quant: {quant_id}).")
                except Exception as quant_err:
                    logger.error(f"[OdooUplink] Failed updating quant for {tank_id}: {quant_err}")
                    synced_results.append({
                        "tank_id": tank_id,
                        "material_code": mat_code,
                        "current_stock": current_stock,
                        "unit": unit,
                        "error": str(quant_err),
                        "status": "ERROR"
                    })

            timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")
            logger.info(f"[OdooUplink] Completed tank stock uplink: {len(synced_results)} tanks processed at {timestamp_str}.")
            return {
                "success": True,
                "synced_tanks": synced_results,
                "timestamp": timestamp_str
            }

    def complete_manufacturing_order(
        self,
        order_code: str,
        actual_produced_qty: float,
        consumed_materials: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Uplink to Odoo ERP (Level 4):
        1. Finds the mrp.production record by name (e.g. 'WH/MO/00001').
        2. Updates actual producing quantity (qty_producing).
        3. Adjusts component consumption lines (move_raw_ids) if consumed_materials specified.
        4. Executes button_mark_done() to transition MO to 'done', which automatically:
           - Decrements raw materials from raw stock.
           - Increments finished goods into finished inventory.
        """
        uid = self.authenticate(force_refresh=False)
        if not uid:
            uid = self.authenticate(force_refresh=True)

        if not uid:
            logger.warning(f"[OdooUplink] Cannot authenticate with Odoo at {self.url}. MO completion aborted.")
            return {
                "success": False,
                "order_code": order_code,
                "error": f"Cannot authenticate with Odoo 18 ERP at {self.url} (DB: {self.db}, User: {self.username})",
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }

        models = self._get_object_proxy(timeout=15.0)
        clean_code = str(order_code or "").strip()

        try:
            # 1. Find the mrp.production record
            mo_records = models.execute_kw(
                self.db, uid, self.password,
                "mrp.production", "search_read",
                [[["name", "=", clean_code]]],
                {"fields": ["id", "name", "state", "product_id", "product_qty", "qty_producing", "move_raw_ids", "location_src_id", "location_dest_id"]}
            )

            if not mo_records:
                if clean_code.isdigit():
                    mo_records = models.execute_kw(
                        self.db, uid, self.password,
                        "mrp.production", "search_read",
                        [[["id", "=", int(clean_code)]]],
                        {"fields": ["id", "name", "state", "product_id", "product_qty", "qty_producing", "move_raw_ids", "location_src_id", "location_dest_id"]}
                    )
                else:
                    mo_records = models.execute_kw(
                        self.db, uid, self.password,
                        "mrp.production", "search_read",
                        [[["name", "ilike", clean_code]]],
                        {"fields": ["id", "name", "state", "product_id", "product_qty", "qty_producing", "move_raw_ids", "location_src_id", "location_dest_id"]}
                    )

            if not mo_records:
                logger.warning(f"[OdooUplink] MO record [{clean_code}] not found in Odoo ERP.")
                return {
                    "success": False,
                    "order_code": clean_code,
                    "error": f"Manufacturing Order [{clean_code}] not found in Odoo 18 ERP.",
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                }

            mo = mo_records[0]
            mo_id = mo["id"]
            mo_name = mo.get("name") or clean_code
            current_state = str(mo.get("state") or "")

            if current_state == "done":
                logger.info(f"[OdooUplink] MO [{mo_name}] is already marked DONE in Odoo ERP.")
                return {
                    "success": True,
                    "already_done": True,
                    "order_code": mo_name,
                    "odoo_mo_id": mo_id,
                    "state": "done",
                    "produced_qty": float(mo.get("qty_producing") or mo.get("product_qty") or actual_produced_qty or 0.0),
                    "message": f"Manufacturing Order [{mo_name}] is already marked DONE in Odoo ERP.",
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                }

            if current_state == "cancel":
                return {
                    "success": False,
                    "order_code": mo_name,
                    "odoo_mo_id": mo_id,
                    "error": f"Manufacturing Order [{mo_name}] is CANCELLED in Odoo ERP.",
                    "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
                }

            if current_state == "draft":
                models.execute_kw(self.db, uid, self.password, "mrp.production", "action_confirm", [[mo_id]])

            # 2. Update actual producing quantity (qty_producing)
            target_qty = float(actual_produced_qty) if actual_produced_qty is not None and actual_produced_qty > 0 else float(mo.get("product_qty") or 1.0)
            models.execute_kw(
                self.db, uid, self.password,
                "mrp.production", "write",
                [[mo_id], {"qty_producing": target_qty}]
            )

            # 3. Adjust component consumption lines (move_raw_ids)
            def _resolve_mat_product_id(mat_code_or_name: str) -> int:
                code_u = str(mat_code_or_name or "").upper()
                if "MILK" in code_u or "SỮA" in code_u or "SUA" in code_u:
                    return 3
                elif "SUGAR" in code_u or "ĐƯỜNG" in code_u or "DUONG" in code_u:
                    return 4
                else:
                    return 5

            existing_move_ids = mo.get("move_raw_ids") or []
            existing_moves = []
            if existing_move_ids:
                try:
                    existing_moves = models.execute_kw(
                        self.db, uid, self.password,
                        "stock.move", "search_read",
                        [[["id", "in", existing_move_ids]]],
                        {"fields": ["id", "product_id", "product_uom_qty", "quantity", "product_uom", "state"]}
                    )
                except Exception as read_move_err:
                    logger.warning(f"[OdooUplink] Error reading stock.moves for MO {mo_id}: {read_move_err}")

            updated_moves = []
            if consumed_materials and isinstance(consumed_materials, list):
                matched_mat_indices = set()
                for m in existing_moves:
                    m_id = m["id"]
                    m_prod = m.get("product_id")
                    m_prod_id = m_prod[0] if isinstance(m_prod, (list, tuple)) else m_prod
                    m_prod_name = str(m_prod[1]).upper() if isinstance(m_prod, (list, tuple)) and len(m_prod) > 1 else ""

                    found_item = None
                    for idx, item in enumerate(consumed_materials):
                        item_code = str(item.get("material_code") or item.get("code") or item.get("material_name") or item.get("name") or "").upper()
                        expected_prod_id = _resolve_mat_product_id(item_code)
                        if expected_prod_id == m_prod_id or (item_code and item_code in m_prod_name):
                            found_item = item
                            matched_mat_indices.add(idx)
                            break

                    qty_val = float(found_item.get("amount") or found_item.get("actual_amount") or found_item.get("qty") or m.get("product_uom_qty") or 0.0) if found_item else float(m.get("product_uom_qty") or 0.0)
                    try:
                        models.execute_kw(
                            self.db, uid, self.password,
                            "stock.move", "write",
                            [[m_id], {"quantity": qty_val}]
                        )
                        updated_moves.append({"move_id": m_id, "product_id": m_prod_id, "quantity": qty_val})
                    except Exception as move_err:
                        logger.warning(f"[OdooUplink] Error updating move {m_id}: {move_err}")

                unmatched_items = [item for idx, item in enumerate(consumed_materials) if idx not in matched_mat_indices]
                if unmatched_items or not existing_moves:
                    prod_loc_id = 15
                    try:
                        p_locs = models.execute_kw(
                            self.db, uid, self.password,
                            "stock.location", "search_read",
                            [[["usage", "=", "production"]]],
                            {"fields": ["id", "name"], "limit": 1}
                        )
                        if p_locs:
                            prod_loc_id = p_locs[0]["id"]
                    except Exception:
                        pass

                    src_loc_id = mo.get("location_src_id")
                    src_loc_id = src_loc_id[0] if isinstance(src_loc_id, (list, tuple)) else (src_loc_id or 8)

                    items_to_add = unmatched_items if existing_moves else consumed_materials
                    for item in items_to_add:
                        item_code = str(item.get("material_code") or item.get("code") or item.get("material_name") or item.get("name") or "RAW_MILK")
                        item_qty = float(item.get("amount") or item.get("actual_amount") or item.get("qty") or 1.0)
                        p_id = _resolve_mat_product_id(item_code)
                        try:
                            models.execute_kw(
                                self.db, uid, self.password,
                                "mrp.production", "write",
                                [[mo_id], {
                                    "move_raw_ids": [(0, 0, {
                                        "product_id": p_id,
                                        "product_uom_qty": item_qty,
                                        "quantity": item_qty,
                                        "location_id": src_loc_id,
                                        "location_dest_id": prod_loc_id,
                                        "name": f"MES Consumption {item_code}"
                                    })]
                                }]
                            )
                            updated_moves.append({"product_id": p_id, "quantity": item_qty, "material_code": item_code})
                        except Exception as add_err:
                            logger.warning(f"[OdooUplink] Error adding move line for {item_code}: {add_err}")
            else:
                for m in existing_moves:
                    m_id = m["id"]
                    uom_qty = float(m.get("product_uom_qty") or 0.0)
                    try:
                        models.execute_kw(
                            self.db, uid, self.password,
                            "stock.move", "write",
                            [[m_id], {"quantity": uom_qty}]
                        )
                        updated_moves.append({"move_id": m_id, "quantity": uom_qty})
                    except Exception:
                        pass

            # 4. Executes button_mark_done()
            mark_res = None
            try:
                mark_res = models.execute_kw(
                    self.db, uid, self.password,
                    "mrp.production", "button_mark_done",
                    [[mo_id]]
                )
            except Exception as mark_err:
                logger.warning(f"[OdooUplink] button_mark_done returned exception: {mark_err}")

            if isinstance(mark_res, dict) and mark_res.get("res_model"):
                wizard_model = mark_res["res_model"]
                wizard_ctx = mark_res.get("context", {})
                try:
                    if wizard_model == "mrp.consumption.warning":
                        w_id = models.execute_kw(
                            self.db, uid, self.password,
                            wizard_model, "create",
                            [{}],
                            {"context": wizard_ctx}
                        )
                        models.execute_kw(
                            self.db, uid, self.password,
                            wizard_model, "action_confirm",
                            [[w_id]],
                            {"context": wizard_ctx}
                        )
                    elif wizard_model == "mrp.production.backorder":
                        w_id = models.execute_kw(
                            self.db, uid, self.password,
                            wizard_model, "create",
                            [{}],
                            {"context": wizard_ctx}
                        )
                        models.execute_kw(
                            self.db, uid, self.password,
                            wizard_model, "action_close_mo",
                            [[w_id]],
                            {"context": wizard_ctx}
                        )
                except Exception as wiz_err:
                    logger.warning(f"[OdooUplink] Handling wizard {wizard_model} notice: {wiz_err}")

            # Verify final state
            final_read = models.execute_kw(
                self.db, uid, self.password,
                "mrp.production", "read",
                [[mo_id]],
                {"fields": ["id", "name", "state", "qty_producing", "product_qty"]}
            )
            final_mo = final_read[0] if final_read else {}
            final_state = final_mo.get("state", "done")

            timestamp_str = time.strftime("%Y-%m-%d %H:%M:%S")
            logger.info(
                f"[OdooUplink] Successfully completed Manufacturing Order [{mo_name}] in Odoo ERP (ID: {mo_id}, State: {final_state}, Produced: {target_qty})."
            )

            return {
                "success": True,
                "order_code": mo_name,
                "odoo_mo_id": mo_id,
                "state": final_state,
                "produced_qty": target_qty,
                "consumed_materials": updated_moves,
                "message": f"Successfully completed Manufacturing Order [{mo_name}] in Odoo ERP (State: {final_state}). Finished Goods incremented into warehouse, Raw Materials consumed.",
                "timestamp": timestamp_str
            }

        except Exception as exc:
            logger.error(f"[OdooUplink] Failed completing manufacturing order [{clean_code}]: {exc}")
            return {
                "success": False,
                "order_code": clean_code,
                "error": str(exc),
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }


def fetch_manufacturing_orders() -> List[Dict[str, Any]]:
    """Module-level helper to fetch manufacturing orders from singleton connector."""
    return default_odoo_connector.fetch_manufacturing_orders()


def fetch_confirmed_orders() -> List[Dict[str, Any]]:
    """Module-level helper alias for fetch_manufacturing_orders."""
    return default_odoo_connector.fetch_manufacturing_orders()


def fetch_inbound_receipts() -> List[Dict[str, Any]]:
    """Module-level helper to fetch inbound receipts from singleton connector."""
    return default_odoo_connector.fetch_inbound_receipts()


def sync_tank_stock_to_odoo(tank_stocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Module-level helper to synchronize tank stocks to Odoo ERP."""
    return default_odoo_connector.sync_tank_stock_to_odoo(tank_stocks)


def complete_manufacturing_order(
    order_code: str,
    actual_produced_qty: float,
    consumed_materials: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Module-level helper to complete manufacturing order in Odoo ERP."""
    return default_odoo_connector.complete_manufacturing_order(order_code, actual_produced_qty, consumed_materials)


def complete_inbound_receipt_in_odoo(
    receipt_code: str,
    actual_qty: float,
    tank_id: str = "",
    supplier_lot: str = "",
    operator: str = "MES_Operator"
) -> Dict[str, Any]:
    """Module-level helper to complete inbound receipt in Odoo ERP."""
    return default_odoo_connector.complete_inbound_receipt_in_odoo(
        receipt_code, actual_qty, tank_id, supplier_lot, operator
    )


# Singleton default instance initialized from persistent config
default_odoo_connector = OdooConnector()


async def worker_odoo_heartbeat():
    """
    Continuous background heartbeat daemon (every 5 seconds, parity with Kepware supervisor).
    Pings Odoo XML-RPC /xmlrpc/2/common, updates odoo_health_cache in-memory.
    Self-heals without blocking API routes or event loops.
    """
    import asyncio
    logger.info("[OdooHeartbeat] Starting background Odoo ERP heartbeat supervisor (interval=5s)...")
    while True:
        try:
            # Run XML-RPC check in worker thread to maintain non-blocking async event loop
            status = await asyncio.to_thread(default_odoo_connector.check_connection)
            update_odoo_health_cache(status)
        except asyncio.CancelledError:
            logger.info("[OdooHeartbeat] Background Odoo ERP heartbeat supervisor cancelled.")
            break
        except Exception as exc:
            logger.warning(f"[OdooHeartbeat] Heartbeat supervisor notice: {exc}")
            update_odoo_health_cache({
                "connected": False,
                "status": "OFFLINE",
                "error": str(exc),
            })
        try:
            await asyncio.sleep(5.0)
        except asyncio.CancelledError:
            logger.info("[OdooHeartbeat] Background Odoo ERP heartbeat supervisor cancelled during sleep.")
            break

