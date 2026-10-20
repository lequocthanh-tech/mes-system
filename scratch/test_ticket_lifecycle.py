import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.path.abspath("backend"))

import historian

print("--- 1. RECORDING TEST MAINTENANCE WORK ORDER ---")
res = historian.record_maintenance_event(
    equipment_id=1,
    equipment_code="PUMP_INLET_MILK",
    ticket_type="PREVENTIVE",
    maintenance_type="Periodic Inspection",
    description="Kiểm tra định kỳ 500h và thay phớt cơ khí Viton",
    action_taken="Vệ sinh, tra mỡ SKF LGHP 2, siết lại bu lông bệ",
    spare_parts_used="Phớt Viton 32mm, Mỡ bôi trơn SKF",
    remarks="Thiết bị chạy êm, rung động chuẩn ISO 10816",
    technician="Kỹ sư Nguyễn Thành Long",
    cost_vnd=650000,
    reset_runtime=True
)
print("Result:", res)

print("\n--- 2. VERIFYING MAINTENANCE HISTORY ---")
logs = historian.get_maintenance_history()
print(f"Total maintenance logs: {len(logs)}")
for l in logs[:2]:
    print(f"  Log ID: {l.get('log_id')} | Code: {l.get('equipment_code')} | Ticket: {l.get('ticket_type')} | Parts: {l.get('spare_parts_used')} | Cost: {l.get('cost_vnd')} VND")

print("\n--- 3. VERIFYING EQUIPMENT STATUS & RUNTIME RESET ---")
eqs = historian.get_all_equipment()
milk_pump = next((e for e in eqs if e.get("EquipmentCode") == "PUMP_INLET_MILK"), None)
if milk_pump:
    print(f"  PUMP_INLET_MILK: Status={milk_pump.get('CurrentStatus')} | Runtime={milk_pump.get('Runtime_Hours')}h | ServiceCount={milk_pump.get('Maintenance_Count')}")
