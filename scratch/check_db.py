import sys
import os
sys.path.append(os.path.abspath("backend"))
import db_connector as dbc

conn = dbc.get_connection()
cur = conn.cursor()
cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Equipment_Maintenance'")
print("Equipment_Maintenance columns:")
for row in cur.fetchall():
    print(f"  {row[0]} ({row[1]})")

cur.execute("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Equipment_Master'")
print("\nEquipment_Master columns:")
for row in cur.fetchall():
    print(f"  {row[0]} ({row[1]})")

cur.execute("SELECT EquipmentID, EquipmentCode, EquipmentName, CurrentStatus, Runtime_Hours, MaintenanceLimit_Hours FROM dbo.Equipment_Master")
print("\nEquipment_Master current rows:")
for row in cur.fetchall():
    print(f"  ID:{row[0]}, Code:{row[1]}, Name:{row[2]}, Status:{row[3]}, Runtime:{row[4]}, Limit:{row[5]}")

conn.close()
