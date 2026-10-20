"""
/* Hallmark · component: DualRunBatchEngine · register: industrial-workbench
 * standards: ISA-88 Batch Control / ISA-95 MOM / ISA-101 HMI
 * strict: Central OPC UA Gateway Session Reuse (Port 49320)
 */

Dual-Run SIMIT Digital Twin Benchmarking and Real-Time Deviation Engine.
Orchestrates parallel or isolated batch execution across:
  - Process Cell 1 (Physical Siemens S7-1500 PLC)
  - Process Cell 2 (Siemens SIMIT Virtual Digital Twin)
"""

import os
import sys
import time
import json
import asyncio
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

logger = logging.getLogger("DualRunBatchEngine")

# Ensure backend directory in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# ============================================================================
# ============================================================================
# PHYSICAL UNIT CONSTRAINTS & CAMPAIGN SIZING (ISA-88 / ISA-95)
# ============================================================================

VESSEL_MAX_CAPACITY: float = 5.0   # Physical geometric volume of Mixing/Heating vessel (L)
SAFE_MAX_RATIO: float = 0.90       # 90% -> V_safe_max = 4.50 L (headspace to prevent vortex spilling)
MIN_STABLE_RATIO: float = 0.40     # 40% -> V_min_stable = 2.00 L (submerge PT100 probe & impeller, prevent SSR thermal overshoot)
SWEET_SPOT_MIN_RATIO: float = 0.65 # 65% -> 3.25 L to 4.50 L (Optimal thermal & mechanical efficiency zone)

def calculate_optimal_batch_campaign(
    total_order_volume: float,
    vessel_capacity: float = 5.0,
    safe_max_ratio: float = 0.90,
    min_stable_ratio: float = 0.40,
    recipe_ratios: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    ISA-88 / ISA-95 Optimal Batch Sizing & Campaign Load Equalization Engine.
    When ERP order volume exceeds physical vessel safe capacity (e.g. 18.0 L on 5.0 L tank),
    computes optimal batch count (N) and equalized batch volume (V_batch) to prevent
    vortex splashing, PT100 sensor exposure, and SSR thermal overshoot.
    """
    import math

    v_safe_max = round(vessel_capacity * safe_max_ratio, 2)
    v_min_stable = round(vessel_capacity * min_stable_ratio, 2)
    v_sweet_min = round(vessel_capacity * SWEET_SPOT_MIN_RATIO, 2)

    total_order_volume = float(total_order_volume or 0.0)

    if total_order_volume <= 0:
        return {
            "total_order_volume": 0.0,
            "vessel_max_capacity": vessel_capacity,
            "safe_max_capacity": v_safe_max,
            "min_stable_volume": v_min_stable,
            "safe_max_ratio": safe_max_ratio,
            "campaign_required": False,
            "batch_count": 0,
            "optimal_batches_count": 0,
            "equalized_batch_volume": 0.0,
            "load_factor_pct": 0.0,
            "is_in_sweet_spot": False,
            "estimated_energy_saving_pct": 0.0,
            "recipe_setpoints_per_batch": {
                "milk_sp": 0.0, "sugar_sp": 0.0, "additive_sp": 0.0,
                "heating_sp": 138.0, "cooling_sp": 4.0, "agitator_sp": 1200.0
            },
            "campaign_total_materials": {"total_milk": 0.0, "total_sugar": 0.0, "total_additive": 0.0},
            "naive_split": {"full_batches": 0, "remnant_volume": 0.0, "explanation": "Không có khối lượng đặt hàng."},
            "campaign_schedule": [],
            "recommendation_text": "Chưa có thể tích mẻ sản xuất."
        }

    # Formulation ratios (Default: Milk 70%, Sugar 20%, Additive 10%)
    ratios = recipe_ratios or {}
    r_milk = ratios.get("milk", ratios.get("milk_sp", 0.70))
    r_sugar = ratios.get("sugar", ratios.get("sugar_sp", 0.20))
    r_additive = ratios.get("additive", ratios.get("additive_sp", 0.10))

    if total_order_volume <= v_safe_max:
        batch_count = 1
        equalized_batch_volume = round(total_order_volume, 2)
        campaign_required = False
    else:
        batch_count = math.ceil(total_order_volume / v_safe_max)
        equalized_batch_volume = round(total_order_volume / batch_count, 2)
        campaign_required = True

    # Naive split comparison
    naive_full_batches = int(total_order_volume // vessel_capacity)
    naive_remnant = round(total_order_volume - (naive_full_batches * vessel_capacity), 2)
    if naive_remnant > 0:
        naive_explanation = (
            f"Phương án ngây thơ chia {naive_full_batches} mẻ kịch trần ({vessel_capacity:.1f}L) + 1 mẻ vét lẻ {naive_remnant:.2f}L "
            f"bị TỪ CHỐI: Mẻ vét {naive_remnant:.2f}L không ngập đủ cảm biến PT100 và cánh khuấy, gây quán tính nhiệt sai lệch "
            f"làm bộc phát nhiệt quá mức (SSR thermal overshoot) và xém cháy sữa."
        )
    else:
        naive_explanation = (
            f"Phương án chia {naive_full_batches} mẻ kịch trần 100% ({vessel_capacity:.1f}L) thiếu 10% khoảng không an toàn "
            f"(headspace), có nguy cơ sánh tràn khi cánh khuấy quay ở 1200 RPM."
        )

    # Per-batch scaled setpoints
    milk_sp = round(equalized_batch_volume * r_milk, 2)
    sugar_sp = round(equalized_batch_volume * r_sugar, 2)
    additive_sp = round(equalized_batch_volume * r_additive, 2)

    # Campaign total materials
    total_milk = round(total_order_volume * r_milk, 2)
    total_sugar = round(total_order_volume * r_sugar, 2)
    total_additive = round(total_order_volume * r_additive, 2)

    # Stability & Energy metrics
    load_factor_pct = round((equalized_batch_volume / vessel_capacity) * 100.0, 1)
    is_in_sweet_spot = (v_min_stable <= equalized_batch_volume <= v_safe_max)
    estimated_energy_saving_pct = round(min(25.0, 6.5 + 4.5 * (batch_count - 1)), 1) if campaign_required else 0.0

    # Build campaign schedule
    campaign_schedule = [
        {
            "batch_index": i,
            "batch_label": f"Mẻ {i}/{batch_count}",
            "planned_volume": equalized_batch_volume,
            "milk_sp": milk_sp,
            "sugar_sp": sugar_sp,
            "additive_sp": additive_sp,
            "status": "READY" if i == 1 else "PENDING"
        }
        for i in range(1, batch_count + 1)
    ]

    recommendation_text = (
        f"Kế hoạch ISA-88 tối ưu: Chia đều đơn hàng {total_order_volume:.2f}L thành {batch_count} mẻ đồng nhất "
        f"với thể tích {equalized_batch_volume:.2f}L/mẻ (Tải {load_factor_pct}% bồn {vessel_capacity:.1f}L). "
        f"Đảm bảo an toàn cơ học chống tràn bồn, tối ưu hóa quá trình truyền nhiệt gia nhiệt SSR và duy trì chất lượng sữa đồng đều."
    )

    return {
        "total_order_volume": total_order_volume,
        "vessel_max_capacity": vessel_capacity,
        "safe_max_capacity": v_safe_max,
        "min_stable_volume": v_min_stable,
        "safe_max_ratio": safe_max_ratio,
        "campaign_required": campaign_required,
        "batch_count": batch_count,
        "optimal_batches_count": batch_count,
        "equalized_batch_volume": equalized_batch_volume,
        "load_factor_pct": load_factor_pct,
        "is_in_sweet_spot": is_in_sweet_spot,
        "estimated_energy_saving_pct": estimated_energy_saving_pct,
        "recipe_setpoints_per_batch": {
            "milk_sp": milk_sp,
            "sugar_sp": sugar_sp,
            "additive_sp": additive_sp,
            "heating_sp": 138.0,
            "cooling_sp": 4.0,
            "agitator_sp": 1200.0
        },
        "campaign_total_materials": {
            "total_milk": total_milk,
            "total_sugar": total_sugar,
            "total_additive": total_additive
        },
        "naive_split": {
            "full_batches": naive_full_batches,
            "remnant_volume": naive_remnant,
            "explanation": naive_explanation
        },
        "campaign_schedule": campaign_schedule,
        "recommendation_text": recommendation_text
    }

# ============================================================================
# STATE REPOSITORY (THREAD-SAFE SINGLETON)
# ============================================================================

class DualRunBatchState:
    def __init__(self):
        # 3-Way Execution Mode:
        # 'mode1_physical': Process Cell 1 (Physical S7-1500 Hardware Only)
        # 'mode2_simit': Process Cell 2 (SIMIT Digital Twin Only)
        # 'mode3_dual': Dual-Run Benchmark (Physical + SIMIT Twin Synchronized)
        self.execution_mode: str = "mode3_dual"
        
        # Current active batch info
        self.order_code: Optional[str] = None
        self.recipe_name: Optional[str] = "Fresh Pasteurized Milk"
        self.target_volume: float = 1000.0
        self.batch_state: str = "IDLE"  # IDLE, DOWNLOADING, READY, RUNNING, COMPLETED, HELD, STOPPED

        # ISA-88 Campaign tracking
        self.total_order_volume: float = 1000.0
        self.campaign_batch_count: int = 1
        self.current_campaign_batch: int = 1
        self.equalized_batch_volume: float = 1000.0
        self.campaign_plan: Optional[Dict[str, Any]] = None
        
        # Setpoints cache
        self.recipe_setpoints: Dict[str, float] = {
            "milk_sp": 700.0,
            "sugar_sp": 200.0,
            "additive_sp": 100.0,
            "heating_sp": 138.0,
            "cooling_sp": 4.0,
            "agitator_sp": 1200.0
        }
        
        # Timestamps for benchmarking
        self.t_start_cell1: Optional[float] = None
        self.t_start_cell2: Optional[float] = None
        self.t_end_cell1: Optional[float] = None
        self.t_end_cell2: Optional[float] = None
        
        # Handshake & Acknowledgment flags
        self.cell1_ack: bool = False
        self.cell2_ack: bool = False
        
        # Independent Completion Flags
        self.cell1_complete: bool = False
        self.cell2_complete: bool = False
        self.completion_processed: bool = False
        
        # State IDs (ISA-88 code 0..11)
        self.cell1_state_id: int = 0
        self.cell2_state_id: int = 0
        
        # Active procedural phase
        self.cell1_current_phase: str = "PH_IDLE"
        self.cell2_current_phase: str = "PH_IDLE"

    def reset(self):
        self.order_code = None
        self.batch_state = "IDLE"
        self.total_order_volume = 0.0
        self.campaign_batch_count = 1
        self.current_campaign_batch = 1
        self.equalized_batch_volume = 0.0
        self.campaign_plan = None
        self.t_start_cell1 = None
        self.t_start_cell2 = None
        self.t_end_cell1 = None
        self.t_end_cell2 = None
        self.cell1_ack = False
        self.cell2_ack = False
        self.cell1_complete = False
        self.cell2_complete = False
        self.completion_processed = False
        self.cell1_state_id = 0
        self.cell2_state_id = 0
        self.cell1_current_phase = "PH_IDLE"
        self.cell2_current_phase = "PH_IDLE"

state = DualRunBatchState()

# ============================================================================
# GATEWAY TAG UTILITIES (STRICT CENTRAL SESSION REUSE)
# ============================================================================

def get_kepware_gateway():
    """Dynamically imports kepware_gateway singleton without circular dependencies."""
    try:
        import kepware_gateway
        return kepware_gateway
    except ImportError:
        try:
            from . import kepware_gateway
            return kepware_gateway
        except Exception:
            return None

def _safe_float(val: Any) -> Optional[float]:
    """Safely converts arbitrary telemetry values to float, returning None on unparseable/bad values."""
    if val is None:
        return None
    try:
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, bool):
            return 1.0 if val else 0.0
        s = str(val).strip()
        if not s or s.lower() in ("nan", "none", "null", "bad", "--", "undefined"):
            return None
        return float(s)
    except (ValueError, TypeError):
        return None

def resolve_operations_tags() -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Resolves mapped NodeIds for cell1 and cell2_simit from tag_mappings.json.
    Returns: (cell1_tags, cell2_tags)
    Guarded with try...except so missing or corrupted mappings never crash the process.
    """
    try:
        kw = get_kepware_gateway()
        if not kw or not hasattr(kw, "load_modular_tag_mappings"):
            return {}, {}
        modular = kw.load_modular_tag_mappings()
        if not isinstance(modular, dict):
            return {}, {}
        ops = modular.get("operations", {})
        if not isinstance(ops, dict):
            return {}, {}
        
        def _extract_tag_dict(section_data: Any) -> Dict[str, str]:
            res: Dict[str, str] = {}
            if isinstance(section_data, dict):
                for k, v in section_data.items():
                    if isinstance(v, str):
                        nid = v.strip()
                        if nid and nid != "[CHƯA ÁNH XẠ]":
                            res[k] = nid
                    elif isinstance(v, dict):
                        nid = str(v.get("node_id", "")).strip()
                        if nid and nid != "[CHƯA ÁNH XẠ]":
                            res[k] = nid
            return res

        cell1_tags = _extract_tag_dict(ops.get("cell1", {}))
        cell2_tags = _extract_tag_dict(ops.get("cell2_simit", {}))

        # Aliases / fallbacks for Cell 1 if legacy top-level keys used
        fallback_map_cell1 = {
            "Heating_SP": ["uht_temp_sp", "pc1_uht_temp_sp"],
            "Heating_PV": ["uht_temp_pv", "pc1_uht_temp_pv"],
            "Cooling_SP": ["cooling_temp_sp"],
            "Cooling_PV": ["cooling_temp_pv"],
            "Agitator_SP": ["agitator_speed_sp"],
            "Agitator_PV": ["agitator_speed_pv"],
            "CMD_Start": ["batch_start_cmd"],
            "State_ID": ["pc1_batch_state", "batch_state"],
            "Flag_Complete": ["batch_complete_flag"],
            "Mixing_Weight_PV": ["mixing_weight_pv", "cell1.Mixing_Weight_PV", "TANK_ALL_ACT_KL"],
            "Mixing_Temp_PV": ["mixing_temp_pv", "cell1.Mixing_Temp_PV"],
            "SSR_Heater_Status": ["ssr_heater_status", "cell1.SSR_Heater_Status", "PID_OUT_SSR", "HEATER_RUN_STATUS"],
            "Heater_Ready_Flag": ["heater_ready_flag", "cell1.Heater_Ready_Flag", "HEATER_TEMP_OK"],
        }
        for target_k, aliases in fallback_map_cell1.items():
            if target_k not in cell1_tags:
                for al in aliases:
                    v = ops.get(al)
                    if isinstance(v, str) and v.strip() and v.strip() != "[CHƯA ÁNH XẠ]":
                        cell1_tags[target_k] = v.strip()
                        break
                    elif isinstance(v, dict):
                        nid = str(v.get("node_id", "")).strip()
                        if nid and nid != "[CHƯA ÁNH XẠ]":
                            cell1_tags[target_k] = nid
                            break

        # Aliases / fallbacks for Cell 2 (SIMIT)
        fallback_map_cell2 = {
            "Heating_SP": ["pc2_simit_uht_temp_sp"],
            "Heating_PV": ["pc2_simit_uht_temp_pv"],
            "State_ID": ["pc2_simit_batch_state"],
            "Mixing_Weight_PV": ["pc2_simit_mixing_weight_pv", "mixing_weight_pv"],
            "Mixing_Temp_PV": ["pc2_simit_mixing_temp_pv", "mixing_temp_pv"],
            "SSR_Heater_Status": ["pc2_simit_ssr_heater_status", "ssr_heater_status"],
            "Heater_Ready_Flag": ["pc2_simit_heater_ready_flag", "heater_ready_flag"],
        }
        for target_k, aliases in fallback_map_cell2.items():
            if target_k not in cell2_tags:
                for al in aliases:
                    v = ops.get(al)
                    if isinstance(v, str) and v.strip() and v.strip() != "[CHƯA ÁNH XẠ]":
                        cell2_tags[target_k] = v.strip()
                        break
                    elif isinstance(v, dict):
                        nid = str(v.get("node_id", "")).strip()
                        if nid and nid != "[CHƯA ÁNH XẠ]":
                            cell2_tags[target_k] = nid
                            break

        return cell1_tags, cell2_tags
    except Exception as exc:
        logger.warning(f"[resolve_operations_tags] Warning resolving tag mappings: {exc}")
        return {}, {}

def read_tag_from_cache(node_id: str) -> Optional[Any]:
    """
    Sub-millisecond read strictly from central in-memory cache latest_cache["tags"].
    Zero socket port creation, zero asyncua Client instances.
    """
    try:
        if not node_id:
            return None
        kw = get_kepware_gateway()
        if not kw or not hasattr(kw, "latest_cache"):
            return None
        cache = kw.latest_cache.get("tags", {})
        clean_nid = node_id.replace("ns=2;s=", "").strip()
        
        entry = cache.get(node_id) or cache.get(clean_nid) or cache.get(f"ns=2;s={clean_nid}")
        if entry and entry.get("value") is not None:
            return entry.get("value")
        return None
    except Exception as exc:
        logger.debug(f"[read_tag_from_cache] Error reading {node_id}: {exc}")
        return None

async def write_tag_central(node_id: str, value: Any, data_type: str = "Float") -> bool:
    """
    Writes tag through existing central OPC UA session via kepware_gateway.write_opc_tag.
    Zero new sockets, strict reuse of opc_mgr connection.
    """
    if not node_id:
        return False
    kw = get_kepware_gateway()
    if not kw or not hasattr(kw, "write_opc_tag"):
        return False
    try:
        await kw.write_opc_tag(node_id, value, data_type)
        return True
    except Exception as exc:
        logger.warning(f"[write_tag_central] OPC UA write warning for {node_id}: {exc}")
        return False

# ============================================================================
# RECIPE DOWNLOAD ENGINE (ISA-88 PARAMETER DOWNLINK)
# ============================================================================

async def download_recipe(
    order_code: str,
    execution_mode: str = "mode3_dual",
    recipe_name: str = "Fresh Pasteurized Milk",
    target_volume: float = 1000.0,
    setpoints: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Executes ISA-88 Recipe Parameter Downlink:
    - Mode 1: Writes SP setpoints to operations.cell1 tags only.
    - Mode 2: Writes SP setpoints to operations.cell2_simit tags only.
    - Mode 3: Concurrently writes SP setpoints to BOTH Cell 1 and Cell 2 tags.
    - Evaluates Ack_Recipe_Loaded handshakes.
    """
    state.order_code = order_code
    state.execution_mode = execution_mode
    state.recipe_name = recipe_name
    state.target_volume = target_volume
    state.total_order_volume = target_volume
    state.batch_state = "DOWNLOADING"
    
    # ISA-88 Campaign load equalization calculation
    plan = calculate_optimal_batch_campaign(target_volume, vessel_capacity=VESSEL_MAX_CAPACITY, safe_max_ratio=SAFE_MAX_RATIO)
    state.campaign_plan = plan
    state.campaign_batch_count = plan.get("batch_count", 1)
    state.current_campaign_batch = 1
    state.equalized_batch_volume = plan.get("equalized_batch_volume", target_volume)

    if setpoints:
        state.recipe_setpoints.update(setpoints)
    else:
        # If campaign is required, download equalized per-batch setpoints to PLC
        if plan.get("campaign_required"):
            state.recipe_setpoints = plan["recipe_setpoints_per_batch"].copy()
        else:
            state.recipe_setpoints = {
                "milk_sp": round(target_volume * 0.70, 2),
                "sugar_sp": round(target_volume * 0.20, 2),
                "additive_sp": round(target_volume * 0.10, 2),
                "heating_sp": 138.0,
                "cooling_sp": 4.0,
                "agitator_sp": 1200.0
            }

    cell1_tags, cell2_tags = resolve_operations_tags()
    written_tags: List[str] = []
    
    # Mapping of setpoint keys to tag keys and types
    sp_config = [
        ("milk_sp", "Milk_SP", "Float"),
        ("sugar_sp", "Sugar_SP", "Float"),
        ("additive_sp", "Additive_SP", "Float"),
        ("heating_sp", "Heating_SP", "Float"),
        ("cooling_sp", "Cooling_SP", "Float"),
        ("agitator_sp", "Agitator_SP", "Float"),
    ]

    target_cells = []
    if execution_mode in ("mode1_physical", "mode3_dual"):
        target_cells.append(("cell1", cell1_tags))
    if execution_mode in ("mode2_simit", "mode3_dual"):
        target_cells.append(("cell2_simit", cell2_tags))

    write_tasks = []
    for cell_label, tags in target_cells:
        for sp_key, tag_key, dtype in sp_config:
            val = state.recipe_setpoints.get(sp_key, 0.0)
            node_id = tags.get(tag_key)
            if node_id:
                write_tasks.append(write_tag_central(node_id, val, dtype))
                written_tags.append(f"{cell_label}.{tag_key} -> {val}")

    write_success = True
    if write_tasks:
        results = await asyncio.gather(*write_tasks, return_exceptions=True)
        for r in results:
            if isinstance(r, Exception) or r is False:
                write_success = False
                logger.warning(f"[Recipe Download] Setpoint write failed or returned exception: {r}")

    # Handshake Acknowledgment evaluation
    # In live physical plant, check Ack_Recipe_Loaded; if unmapped, allow simulated auto-acknowledge
    cell1_ack = False
    cell2_ack = False

    if "cell1" in [c[0] for c in target_cells]:
        ack_node_1 = cell1_tags.get("Ack_Recipe_Loaded")
        if ack_node_1:
            val = read_tag_from_cache(ack_node_1)
            cell1_ack = bool(val) if val is not None else False
        else:
            cell1_ack = True  # Simulated ack fallback only when node not mapped
        state.cell1_ack = cell1_ack and write_success

    if "cell2_simit" in [c[0] for c in target_cells]:
        ack_node_2 = cell2_tags.get("Ack_Recipe_Loaded")
        if ack_node_2:
            val = read_tag_from_cache(ack_node_2)
            cell2_ack = bool(val) if val is not None else False
        else:
            cell2_ack = True  # SIMIT virtual twin auto-acknowledges when node not mapped
        state.cell2_ack = cell2_ack and write_success

    # Determine readiness
    ready_to_start = False
    if execution_mode == "mode1_physical":
        ready_to_start = state.cell1_ack
    elif execution_mode == "mode2_simit":
        ready_to_start = state.cell2_ack
    elif execution_mode == "mode3_dual":
        ready_to_start = state.cell1_ack and state.cell2_ack

    if ready_to_start:
        state.batch_state = "READY"

    return {
        "status": "success",
        "order_code": order_code,
        "execution_mode": execution_mode,
        "recipe_name": recipe_name,
        "written_tags": written_tags,
        "cell1_ack": state.cell1_ack,
        "cell2_ack": state.cell2_ack,
        "ready_to_start": ready_to_start,
        "batch_state": state.batch_state,
        "setpoints": state.recipe_setpoints,
        "campaign_plan": state.campaign_plan,
        "equalized_batch_volume": state.equalized_batch_volume,
        "campaign_batch_count": state.campaign_batch_count,
        "current_campaign_batch": state.current_campaign_batch
    }

# ============================================================================
# BATCH START & 500ms CMD_START PULSE DISPATCHER
# ============================================================================

async def _send_500ms_pulse(node_id: str):
    """Sends CMD_Start = True for 500ms, then sets CMD_Start = False."""
    try:
        await write_tag_central(node_id, True, "Boolean")
        await asyncio.sleep(0.5)
        await write_tag_central(node_id, False, "Boolean")
    except Exception as exc:
        logger.warning(f"[_send_500ms_pulse] Failed to send pulse to {node_id}: {exc}")

async def start_batch(order_code: Optional[str] = None, execution_mode: Optional[str] = None) -> Dict[str, Any]:
    """
    Triggers batch start across active cells:
    1. Emits 500ms pulse on CMD_Start tags.
    2. Records start timestamps: t_start_cell1 and t_start_cell2.
    3. Resets completion trackers.
    """
    mode = execution_mode or state.execution_mode
    state.execution_mode = mode
    if order_code:
        state.order_code = order_code

    now_ts = time.time()
    cell1_tags, cell2_tags = resolve_operations_tags()
    pulse_tasks = []

    # Reset completion flags
    state.cell1_complete = False
    state.cell2_complete = False
    state.t_end_cell1 = None
    state.t_end_cell2 = None

    if mode in ("mode1_physical", "mode3_dual"):
        state.t_start_cell1 = now_ts
        cmd_node_1 = cell1_tags.get("CMD_Start")
        if cmd_node_1:
            pulse_tasks.append(_send_500ms_pulse(cmd_node_1))
        # Note: Per ISA-88, State_ID on Cell 1 is a read-only PLC feedback register driven by the PLC state machine, MES only commands CMD_Start.

    if mode in ("mode2_simit", "mode3_dual"):
        state.t_start_cell2 = now_ts
        cmd_node_2 = cell2_tags.get("CMD_Start")
        if cmd_node_2:
            pulse_tasks.append(_send_500ms_pulse(cmd_node_2))
        # Update SIMIT State_ID = 1 (RUNNING)
        state_node_2 = cell2_tags.get("State_ID")
        if state_node_2:
            pulse_tasks.append(write_tag_central(state_node_2, 1, "Int16"))

    if pulse_tasks:
        asyncio.create_task(asyncio.gather(*pulse_tasks, return_exceptions=True))

    state.batch_state = "RUNNING"

    return {
        "status": "success",
        "batch_state": state.batch_state,
        "execution_mode": mode,
        "order_code": state.order_code,
        "t_start_cell1": state.t_start_cell1,
        "t_start_cell2": state.t_start_cell2,
    }

# ============================================================================
# INDEPENDENT COMPLETION EVALUATION & CLOSED-LOOP AUTOMATION
# ============================================================================

def _trigger_closed_loop_completion(order_code: str):
    """
    Schedules asynchronous execution of inventory consumption, EBR generation,
    campaign auto-advancement, and Odoo ERP uplinks in a non-blocking background task.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(execute_closed_loop_batch_completion(order_code))
    except RuntimeError:
        import threading
        threading.Thread(
            target=lambda: asyncio.run(execute_closed_loop_batch_completion(order_code)),
            daemon=True
        ).start()


async def execute_closed_loop_batch_completion(order_code: str):
    logger.info(f"[ClosedLoopBatch] Starting automated post-batch processing for Order [{order_code}] (Batch {state.current_campaign_batch}/{state.campaign_batch_count})...")
    try:
        try:
            import db_sync_engine
        except ImportError:
            from . import db_sync_engine

        cell1_tags, _ = resolve_operations_tags()

        # 1. Read actual process values from cache with fallback to recipe SP
        sp_milk = state.recipe_setpoints.get("milk_sp", 0.0)
        sp_sugar = state.recipe_setpoints.get("sugar_sp", 0.0)
        sp_additive = state.recipe_setpoints.get("additive_sp", 0.0)
        sp_heating = state.recipe_setpoints.get("heating_sp", 138.0)
        sp_cooling = state.recipe_setpoints.get("cooling_sp", 4.0)

        pv_milk = read_tag_from_cache(cell1_tags.get("Milk_PV"))
        pv_sugar = read_tag_from_cache(cell1_tags.get("Sugar_PV"))
        pv_additive = read_tag_from_cache(cell1_tags.get("Additive_PV"))
        pv_heating = read_tag_from_cache(cell1_tags.get("Heating_PV"))
        pv_cooling = read_tag_from_cache(cell1_tags.get("Cooling_PV"))

        act_milk = float(pv_milk) if (pv_milk is not None and float(pv_milk) > 0) else float(sp_milk)
        act_sugar = float(pv_sugar) if (pv_sugar is not None and float(pv_sugar) > 0) else float(sp_sugar)
        act_additive = float(pv_additive) if (pv_additive is not None and float(pv_additive) > 0) else float(sp_additive)
        act_heating = float(pv_heating) if (pv_heating is not None and float(pv_heating) > 0) else float(sp_heating)
        act_cooling = float(pv_cooling) if (pv_cooling is not None and float(pv_cooling) > 0) else float(sp_cooling)

        batch_vol = state.equalized_batch_volume if (state.campaign_plan and state.equalized_batch_volume > 0) else state.target_volume

        # 2. Automated Inventory Backflush / Single-Shot Deduction with Idempotency Guard
        is_already_deducted = False
        try:
            from db_routes import _single_shot_deducted_orders
            if order_code in _single_shot_deducted_orders:
                is_already_deducted = True
        except Exception:
            pass

        if is_already_deducted:
            logger.info(f"[ClosedLoopBatch] Order [{order_code}] materials already deducted via intermediate hopper single-shot. Skipping duplicate deduction.")
        else:
            try:
                from db_routes import deduct_batch_single_shot, BatchDeductSingleShotPayload
                deduct_payload = BatchDeductSingleShotPayload(
                    order_code=order_code,
                    user="PLC_Auto_Complete",
                    milk_qty=act_milk,
                    sugar_qty=act_sugar,
                    additive_qty=act_additive
                )
                await deduct_batch_single_shot(deduct_payload)
                logger.info(f"[ClosedLoopBatch] Single-shot inventory deduction executed for Order [{order_code}]: Milk={act_milk}L, Sugar={act_sugar}kg, Additive={act_additive}kg")
            except Exception as e:
                logger.warning(f"[ClosedLoopBatch] Single-shot deduction fallback to standard consume_inventory: {e}")
                consumed_items = [
                    {"material_code": "RAW-MILK-01", "amount": act_milk},
                    {"material_code": "SUGAR-01", "amount": act_sugar},
                    {"material_code": "ADDITIVE-01", "amount": act_additive}
                ]
                await asyncio.to_thread(db_sync_engine.consume_inventory, order_code, consumed_items, "PLC_Auto_Complete")

        # 3. Quality Assurance & Electronic Batch Record (EBR) Generation
        # Critical Control Point (CCP-1): Pasteurizer hold temp must be within +/- 2.0°C of SP
        heat_dev = abs(act_heating - sp_heating)
        ccp1_pass = heat_dev <= 2.0
        cool_dev = abs(act_cooling - sp_cooling)
        cool_pass = cool_dev <= 1.5

        overall_quality = "RELEASED" if (ccp1_pass and cool_pass) else "QUARANTINED"
        disposition = "Approved for Aseptic Packaging" if overall_quality == "RELEASED" else "Hold for QA Review (Temperature Deviation)"
        avg_dev = round((heat_dev / max(sp_heating, 1) + cool_dev / max(sp_cooling, 1)) / 2 * 100, 2)
        batch_seq = f"-B{state.current_campaign_batch}" if state.campaign_batch_count > 1 else ""
        report_code = f"EBR-{order_code}{batch_seq}"

        quality_results = [
            {
                "parameter_name": "Pasteurization Temperature (CCP-1)",
                "setpoint": sp_heating,
                "actual_value": act_heating,
                "deviation_percent": round(heat_dev / max(sp_heating, 1) * 100, 2),
                "tolerance_band": "±2.0°C",
                "evaluation": "PASS" if ccp1_pass else "FAIL"
            },
            {
                "parameter_name": "Chilling Temperature",
                "setpoint": sp_cooling,
                "actual_value": act_cooling,
                "deviation_percent": round(cool_dev / max(sp_cooling, 1) * 100, 2),
                "tolerance_band": "±1.5°C",
                "evaluation": "PASS" if cool_pass else "FAIL"
            }
        ]

        await asyncio.to_thread(
            db_sync_engine.create_batch_completion_report,
            order_code=order_code,
            report_code=report_code,
            recipe_applied=state.recipe_name or "Fresh Pasteurized Milk",
            total_produced=batch_vol,
            avg_deviation=avg_dev,
            quality_status=overall_quality,
            disposition=disposition,
            sign_off="System_Auto_Audit",
            quality_results=quality_results
        )
        logger.info(f"[ClosedLoopBatch] EBR [{report_code}] generated with Quality Status: {overall_quality} (CCP-1: {'PASS' if ccp1_pass else 'FAIL'}).")

        # 4. Multi-Batch Campaign Progression or Final Order Completion
        if state.campaign_batch_count > 1 and state.current_campaign_batch < state.campaign_batch_count:
            k = state.current_campaign_batch
            N = state.campaign_batch_count
            logger.info(f"[ClosedLoopBatch] Campaign [{order_code}]: Batch {k}/{N} finished. Auto-advancing to Batch {k+1}/{N}...")
            state.current_campaign_batch += 1
            state.cell1_complete = False
            state.cell2_complete = False
            state.completion_processed = False
            state.batch_state = "RUNNING"
            state.t_start_cell1 = time.time()
            state.t_start_cell2 = time.time()
            state.t_end_cell1 = None
            state.t_end_cell2 = None
        else:
            logger.info(f"[ClosedLoopBatch] Order [{order_code}] completely finalized across all {state.campaign_batch_count} batches. Marking COMPLETED in SQL Server...")
            state.batch_state = "COMPLETED"
            await asyncio.to_thread(db_sync_engine.update_order_status, order_code, "COMPLETED", "PLC_Auto_Complete")

            # 5. Uplink to Odoo ERP (Level 4)
            try:
                try:
                    import db_routes
                except ImportError:
                    from . import db_routes

                if hasattr(db_routes, "uplink_odoo_mo_internal"):
                    total_vol = state.total_order_volume if state.total_order_volume > 0 else state.target_volume
                    logger.info(f"[ClosedLoopBatch] Uplinking Order [{order_code}] ({total_vol}L) to Odoo ERP...")
                    await db_routes.uplink_odoo_mo_internal(order_code, total_vol)

                if hasattr(db_routes, "uplink_tank_stocks_internal"):
                    logger.info("[ClosedLoopBatch] Uplinking current tank inventory levels to Odoo ERP...")
                    await db_routes.uplink_tank_stocks_internal()
            except Exception as odoo_err:
                logger.warning(f"[ClosedLoopBatch] Odoo ERP uplink notice: {odoo_err}")

    except Exception as exc:
        logger.error(f"[ClosedLoopBatch] Error in post-batch execution for Order [{order_code}]: {exc}", exc_info=True)


def evaluate_completion(simulated_cell1: Optional[bool] = None, simulated_cell2: Optional[bool] = None) -> Dict[str, Any]:
    """
    Checks independent completion flags:
    - Cell 1 completes when Flag_Complete == True or State_ID == 11 -> records t_end_cell1.
    - Cell 2 completes when Flag_Complete == True or State_ID == 11 -> records t_end_cell2.
    - Closed-loop execution: triggers automated inventory backflush, EBR report, and multi-batch campaign auto-advance.
    """
    now_ts = time.time()
    try:
        cell1_tags, cell2_tags = resolve_operations_tags()

        # 1. Evaluate Cell 1 (Physical Hardware)
        if state.execution_mode in ("mode1_physical", "mode3_dual") and not state.cell1_complete:
            flag_node_1 = cell1_tags.get("Flag_Complete")
            state_node_1 = cell1_tags.get("State_ID")
            is_done = False
            if simulated_cell1 is True:
                is_done = True
            elif flag_node_1:
                val = read_tag_from_cache(flag_node_1)
                is_done = bool(val) if val is not None else False
            
            if not is_done and state_node_1:
                s_val = read_tag_from_cache(state_node_1)
                if s_val is not None:
                    try:
                        is_done = int(s_val) == 11
                    except (ValueError, TypeError):
                        pass

            if is_done:
                state.cell1_complete = True
                state.t_end_cell1 = now_ts
                state.cell1_state_id = 11  # COMPLETE

        # 2. Evaluate Cell 2 (SIMIT Digital Twin)
        if state.execution_mode in ("mode2_simit", "mode3_dual") and not state.cell2_complete:
            flag_node_2 = cell2_tags.get("Flag_Complete")
            state_node_2 = cell2_tags.get("State_ID")
            is_done = False
            if simulated_cell2 is True:
                is_done = True
            elif flag_node_2:
                val = read_tag_from_cache(flag_node_2)
                is_done = bool(val) if val is not None else False

            if not is_done and state_node_2:
                s_val = read_tag_from_cache(state_node_2)
                if s_val is not None:
                    try:
                        is_done = int(s_val) == 11
                    except (ValueError, TypeError):
                        pass

            if is_done:
                state.cell2_complete = True
                state.t_end_cell2 = now_ts
                state.cell2_state_id = 11  # COMPLETE

        # 3. Overall Order Finalization:
        # In multi-batch campaigns, order finalized only when the final batch (k == N) finishes.
        is_final_batch = (state.current_campaign_batch >= state.campaign_batch_count)
        order_finalized = False
        if state.execution_mode == "mode1_physical":
            order_finalized = state.cell1_complete and is_final_batch
        elif state.execution_mode == "mode2_simit":
            order_finalized = state.cell2_complete and is_final_batch
        elif state.execution_mode == "mode3_dual":
            order_finalized = state.cell1_complete and is_final_batch

        if order_finalized and state.batch_state == "RUNNING":
            state.batch_state = "COMPLETED"

        # 4. Trigger Closed-Loop Post-Batch Processing (guarded by completion_processed)
        batch_finished_flag = state.cell1_complete or (state.execution_mode == "mode2_simit" and state.cell2_complete)
        if batch_finished_flag and not getattr(state, "completion_processed", False) and state.order_code:
            state.completion_processed = True
            _trigger_closed_loop_completion(state.order_code)

        def _format_dur(start: Optional[float], end: Optional[float]) -> str:
            if not start:
                return "--"
            e = end if end else now_ts
            diff = max(0, int(e - start))
            mins, secs = divmod(diff, 60)
            return f"{mins:02d}m{secs:02d}s"

        return {
            "batch_state": state.batch_state,
            "execution_mode": state.execution_mode,
            "cell1_complete": state.cell1_complete,
            "cell2_complete": state.cell2_complete,
            "duration_cell1": _format_dur(state.t_start_cell1, state.t_end_cell1),
            "duration_cell2": _format_dur(state.t_start_cell2, state.t_end_cell2),
            "order_finalized": order_finalized,
            "campaign_batch": state.current_campaign_batch,
            "campaign_total_batches": state.campaign_batch_count
        }
    except Exception as exc:
        logger.warning(f"[evaluate_completion] Evaluation fallback warning: {exc}")
        return {
            "batch_state": state.batch_state,
            "execution_mode": state.execution_mode,
            "cell1_complete": state.cell1_complete,
            "cell2_complete": state.cell2_complete,
            "duration_cell1": "--",
            "duration_cell2": "--",
            "order_finalized": False
        }

# ============================================================================
# DIGITAL TWIN DEVIATION MATRIX & FIDELITY INDEX ENGINE
# ============================================================================

def get_deviation_matrix() -> Dict[str, Any]:
    """
    Computes real-time telemetry matrix comparing:
      - Master Recipe Setpoints (SP)
      - Physical Hardware Live Process Values (Cell 1 PV)
      - SIMIT Virtual Twin Live Process Values (Cell 2 PV)
      - Absolute Deviation Δ = |R - S|
      - Status Badge: MATCHED | DEVIATING | TRACKING | CHƯA ÁNH XẠ
      - Fidelity Index (% matched)
      - Cycle Time Real vs Twin: T_Hardware vs T_SIMIT with Δ T = |T_HW - T_SIMIT|
    """
    try:
        evaluate_completion()
        cell1_tags, cell2_tags = resolve_operations_tags()
    except Exception as exc:
        logger.warning(f"[get_deviation_matrix] Completion evaluation warning: {exc}")
        cell1_tags, cell2_tags = {}, {}
    
    # 6 Core ISA-88 Parameters with units and tolerance thresholds
    params_def = [
        {
            "id": "milk",
            "name": "Cấp sữa tươi (Milk Dosing)",
            "phase": "PH_SUPPLYMILK",
            "sp_key": "milk_sp",
            "unit": "L",
            "tolerance": 10.0,
            "cell1_pv_tag": "Milk_PV",
            "cell2_pv_tag": "Milk_PV"
        },
        {
            "id": "sugar",
            "name": "Định lượng đường (Sugar Dosing)",
            "phase": "PH_SUPPLYSUGAR",
            "sp_key": "sugar_sp",
            "unit": "kg",
            "tolerance": 2.0,
            "cell1_pv_tag": "Sugar_PV",
            "cell2_pv_tag": "Sugar_PV"
        },
        {
            "id": "additive",
            "name": "Vi chất dinh dưỡng (Additive)",
            "phase": "PH_SUPPLYADDITIVE",
            "sp_key": "additive_sp",
            "unit": "L",
            "tolerance": 1.0,
            "cell1_pv_tag": "Additive_PV",
            "cell2_pv_tag": "Additive_PV"
        },
        {
            "id": "heat",
            "name": "Tiệt trùng UHT (Sterilization Temp)",
            "phase": "PH_HEAT",
            "sp_key": "heating_sp",
            "unit": "°C",
            "tolerance": 1.0,
            "cell1_pv_tag": "Heating_PV",
            "cell2_pv_tag": "Heating_PV"
        },
        {
            "id": "cool",
            "name": "Làm lạnh vô trùng (Cooling Temp)",
            "phase": "PH_CHILL",
            "sp_key": "cooling_sp",
            "unit": "°C",
            "tolerance": 0.5,
            "cell1_pv_tag": "Cooling_PV",
            "cell2_pv_tag": "Cooling_PV"
        },
        {
            "id": "agitator",
            "name": "Tốc độ cánh khuấy (Agitator Speed)",
            "phase": "PH_AGITATE",
            "sp_key": "agitator_sp",
            "unit": "RPM",
            "tolerance": 25.0,
            "cell1_pv_tag": "Agitator_PV",
            "cell2_pv_tag": "Agitator_PV"
        },
    ]

    try:
        matrix_rows = []
        matched_count = 0
        mapped_count = 0

        for p in params_def:
            sp_val = _safe_float(state.recipe_setpoints.get(p["sp_key"])) or 0.0
            c1_node = cell1_tags.get(p["cell1_pv_tag"])
            c2_node = cell2_tags.get(p["cell2_pv_tag"])

            has_c1_map = bool(c1_node)
            has_c2_map = bool(c2_node)

            raw_c1_val = read_tag_from_cache(c1_node) if c1_node else None
            raw_c2_val = read_tag_from_cache(c2_node) if c2_node else None

            pv_hardware: Optional[float] = _safe_float(raw_c1_val)
            pv_simit: Optional[float] = _safe_float(raw_c2_val)

            delta: Optional[float] = None
            status: str = "CHƯA ÁNH XẠ"

            if has_c1_map and has_c2_map:
                mapped_count += 1
                # If values exist, calculate delta
                if pv_hardware is not None and pv_simit is not None:
                    delta = round(abs(pv_hardware - pv_simit), 2)
                    is_twin_matched = delta <= p["tolerance"]
                    if is_twin_matched:
                        matched_count += 1

                    if state.batch_state == "RUNNING" and abs(pv_hardware - sp_val) > p["tolerance"]:
                        # Active phase is ramping / tracking
                        status = "TRACKING"
                    elif is_twin_matched:
                        status = "MATCHED"
                    else:
                        status = "DEVIATING"
                else:
                    status = "TRACKING" if state.batch_state == "RUNNING" else "CHƯA ÁNH XẠ"
            elif has_c1_map or has_c2_map:
                # Partially mapped
                status = "CHƯA ÁNH XẠ"
            else:
                status = "CHƯA ÁNH XẠ"

            matrix_rows.append({
                "id": p["id"],
                "name": p["name"],
                "phase": p["phase"],
                "unit": p["unit"],
                "sp": sp_val,
                "pv_hardware": pv_hardware,
                "pv_simit": pv_simit,
                "delta": delta,
                "tolerance": p["tolerance"],
                "status": status,
                "c1_mapped": has_c1_map,
                "c2_mapped": has_c2_map
            })

        # Twin Model Fidelity Index: percentage of mapped parameters within tolerance
        fidelity_index: Optional[float] = None
        if mapped_count > 0:
            fidelity_index = round((matched_count / mapped_count) * 100.0, 1)

        # Cycle Times calculation
        now_ts = time.time()
        def _dur_seconds(start: Optional[float], end: Optional[float]) -> Optional[float]:
            if not start:
                return None
            e = end if end else (now_ts if state.batch_state == "RUNNING" else start)
            return max(0.0, e - start)

        t_hw_sec = _dur_seconds(state.t_start_cell1, state.t_end_cell1)
        t_simit_sec = _dur_seconds(state.t_start_cell2, state.t_end_cell2)

        delta_t_sec: Optional[float] = None
        if t_hw_sec is not None and t_simit_sec is not None:
            delta_t_sec = round(abs(t_hw_sec - t_simit_sec), 1)

        def _format_time_sec(sec: Optional[float]) -> str:
            if sec is None:
                return "--"
            s = int(sec)
            mins, secs = divmod(s, 60)
            return f"{mins:02d}m{secs:02d}s"

        # Read Mixing Tank and Heater Interlock telemetry
        c1_mix_w_node = cell1_tags.get("Mixing_Weight_PV")
        c1_mix_t_node = cell1_tags.get("Mixing_Temp_PV")
        c1_ssr_node = cell1_tags.get("SSR_Heater_Status")
        c1_ready_node = cell1_tags.get("Heater_Ready_Flag")

        mix_w_val: Optional[float] = _safe_float(read_tag_from_cache(c1_mix_w_node)) if c1_mix_w_node else None
        mix_t_val: Optional[float] = _safe_float(read_tag_from_cache(c1_mix_t_node)) if c1_mix_t_node else None

        raw_ssr = read_tag_from_cache(c1_ssr_node) if c1_ssr_node else None
        ssr_active: bool = bool(raw_ssr and str(raw_ssr).strip().lower() not in ("0", "false", "off", "none", "null"))

        raw_ready = read_tag_from_cache(c1_ready_node) if c1_ready_node else None
        if raw_ready is not None:
            heater_ready: bool = bool(raw_ready and str(raw_ready).strip().lower() not in ("0", "false", "off", "none", "null"))
        else:
            # Fallback interlock: If UHT temp reached Heating_SP - 1.0 when running
            uht_sp = _safe_float(state.recipe_setpoints.get("heating_sp")) or 0.0
            uht_pv_node = cell1_tags.get("Heating_PV")
            uht_pv = _safe_float(read_tag_from_cache(uht_pv_node)) if uht_pv_node else None
            heater_ready = bool(uht_sp > 0 and uht_pv is not None and uht_pv >= (uht_sp - 1.0))

        return {
            "execution_mode": state.execution_mode,
            "batch_state": state.batch_state,
            "order_code": state.order_code,
            "recipe_name": state.recipe_name,
            "matrix": matrix_rows,
            "heater_ready": heater_ready,
            "ssr_heating_active": ssr_active,
            "mixing_weight_pv": mix_w_val,
            "mixing_temp_pv": mix_t_val,
            "benchmark_summary": {
                "mapped_parameters": mapped_count,
                "matched_parameters": matched_count,
                "total_parameters": len(params_def),
                "fidelity_index": fidelity_index,
                "t_hardware_sec": t_hw_sec,
                "t_hardware_formatted": _format_time_sec(t_hw_sec),
                "t_simit_sec": t_simit_sec,
                "t_simit_formatted": _format_time_sec(t_simit_sec),
                "delta_t_sec": delta_t_sec,
                "delta_t_formatted": _format_time_sec(delta_t_sec),
                "cell1_complete": state.cell1_complete,
                "cell2_complete": state.cell2_complete
            },
            "campaign_summary": {
                "is_campaign": state.campaign_batch_count > 1,
                "total_order_volume": state.total_order_volume,
                "total_batches": state.campaign_batch_count,
                "current_batch": state.current_campaign_batch,
                "batch_volume": state.equalized_batch_volume,
                "plan": state.campaign_plan
            }
        }
    except Exception as exc:
        logger.warning(f"[get_deviation_matrix] Deviation calculation error: {exc}")
        return {
            "execution_mode": state.execution_mode,
            "batch_state": state.batch_state,
            "order_code": state.order_code,
            "recipe_name": state.recipe_name,
            "matrix": [],
            "heater_ready": False,
            "ssr_heating_active": False,
            "mixing_weight_pv": None,
            "mixing_temp_pv": None,
            "benchmark_summary": None,
            "campaign_summary": {
                "is_campaign": False,
                "total_order_volume": 0.0,
                "total_batches": 1,
                "current_batch": 1,
                "batch_volume": 0.0,
                "plan": None
            }
        }
