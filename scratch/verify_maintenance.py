import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.path.abspath("backend"))

import historian
import kepware_gateway

print("--- 1. EQUIPMENT MASTER (12 ASSETS) ---")
eqs = historian.get_all_equipment()
print(f"Total equipment count: {len(eqs)}")
for e in eqs:
    print(f"  {e.get('EquipmentCode')}: {e.get('EquipmentName')} | Status: {e.get('CurrentStatus')} | Runtime: {e.get('Runtime_Hours')}h / {e.get('Maintenance_Limit_Hours')}h")

print("\n--- 2. TAG MAPPINGS (MAINTENANCE SECTION) ---")
mappings = kepware_gateway.load_modular_tag_mappings()
maint_map = mappings.get("maintenance", {})
print(f"Mapped equipment count: {len(maint_map)}")
for code, tags in maint_map.items():
    print(f"  {code}: {tags}")

print("\n--- 3. MAINTENANCE LOGS ---")
logs = historian.get_maintenance_history()
print(f"Total maintenance logs: {len(logs)}")
for l in logs[:5]:
    print(f"  Log #{l.get('log_id') or l.get('Log_ID')}: {l.get('equipment_code') or l.get('EquipmentCode')} | Action: {l.get('maintenance_type')} | Ticket: {l.get('ticket_type')} | Cost: {l.get('cost_vnd')} VND")
