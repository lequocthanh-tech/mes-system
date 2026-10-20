import sys
import os
import io
import asyncio
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.append(os.path.abspath("backend"))

import db_routes

async def main():
    res = await db_routes.get_maintenance_kpis()
    print("get_maintenance_kpis result:", res)

asyncio.run(main())
