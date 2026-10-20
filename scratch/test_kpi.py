import sys
import os
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.path.abspath("backend"))

from db_connector import execute_query

sql = """
SELECT 
    COUNT(*) AS total_tickets,
    COALESCE(SUM(Cost_VND), 0) AS total_cost_vnd,
    MAX(Completed_Date) AS latest_service_date
FROM dbo.Equipment_Maintenance;
"""
row = execute_query(sql)
print("Maintenance KPI row:", row)
