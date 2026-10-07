import pyodbc
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SQL_Init")

CANDIDATE_SERVERS = [
    r"localhost\WINCC",
    "localhost",
    r"localhost\SQLEXPRESS",
    r".\WINCC",
    r".\SQLEXPRESS",
    "."
]

def find_working_server():
    for s in CANDIDATE_SERVERS:
        conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={s};DATABASE=master;Trusted_Connection=yes;TrustServerCertificate=yes;"
        try:
            conn = pyodbc.connect(conn_str, timeout=3)
            logger.info(f"Connected to SQL Server instance: {s}")
            conn.close()
            return s
        except Exception:
            continue
    return None

def init_mes_database():
    server = find_working_server()
    if not server:
        logger.warning("No running SQL Server instance found on host.")
        return False

    master_conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE=master;Trusted_Connection=yes;TrustServerCertificate=yes;"
    try:
        conn = pyodbc.connect(master_conn_str, autocommit=True, timeout=5)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sys.databases WHERE name = 'MES_Milk_Production'")
        if not cursor.fetchone():
            logger.info("Creating database MES_Milk_Production...")
            cursor.execute("CREATE DATABASE MES_Milk_Production")
            time.sleep(1)
        conn.close()
    except Exception as e:
        logger.error(f"Error checking/creating master DB: {e}")
        return False

    db_conn_str = f"DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE=MES_Milk_Production;Trusted_Connection=yes;TrustServerCertificate=yes;"
    try:
        conn = pyodbc.connect(db_conn_str, autocommit=True, timeout=5)
        cursor = conn.cursor()

        # 1. Material_Stock
        cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Material_Stock' AND xtype='U')
        CREATE TABLE Material_Stock (
            Material_ID VARCHAR(50) PRIMARY KEY,
            Material_Name NVARCHAR(150),
            Tank_ID VARCHAR(50),
            Tank_Name NVARCHAR(150),
            Current_Qty FLOAT,
            Capacity FLOAT,
            Unit VARCHAR(20),
            Min_Threshold FLOAT,
            Last_Updated DATETIME DEFAULT GETDATE()
        )
        """)

        # 2. Customers
        cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Customers' AND xtype='U')
        CREATE TABLE Customers (
            Customer_ID VARCHAR(50) PRIMARY KEY,
            Customer_Code VARCHAR(50),
            Customer_Name NVARCHAR(150),
            Address NVARCHAR(255),
            Email VARCHAR(100),
            Phone VARCHAR(50),
            Priority INT DEFAULT 2,
            Status VARCHAR(20) DEFAULT 'Active',
            ActiveOrders INT DEFAULT 0
        )
        """)

        # 3. Recipes
        cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Recipes' AND xtype='U')
        CREATE TABLE Recipes (
            Recipe_ID VARCHAR(50) PRIMARY KEY,
            Recipe_Name NVARCHAR(150),
            Description NVARCHAR(255),
            Target_Volume FLOAT DEFAULT 1000.0,
            Temp_Hot FLOAT,
            Temp_Cold FLOAT,
            Status VARCHAR(20) DEFAULT 'RELEASED',
            Version VARCHAR(20) DEFAULT 'v2.4'
        )
        """)

        # 4. Recipe_Detail
        cursor.execute("""
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Recipe_Detail' AND xtype='U')
        CREATE TABLE Recipe_Detail (
            Detail_ID INT IDENTITY(1,1) PRIMARY KEY,
            Recipe_ID VARCHAR(50),
            Material_ID VARCHAR(50),
            Material_Name NVARCHAR(150),
            Percentage FLOAT,
            Target_Qty FLOAT,
            Unit VARCHAR(20)
        )
        """)

        # Seed Material_Stock if empty
        cursor.execute("SELECT COUNT(*) FROM Material_Stock")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
            INSERT INTO Material_Stock (Material_ID, Material_Name, Tank_ID, Tank_Name, Current_Qty, Capacity, Unit, Min_Threshold)
            VALUES 
            ('RAW_MILK', N'Fresh Raw Milk (Sữa tươi)', 'TANK-01', N'Raw Milk Silo T-01', 4995.05, 10000.0, 'L', 1500.0),
            ('SUGAR', N'Refined Cane Sugar (Đường tinh luyện)', 'SILO-SUGAR-01', N'Sugar Storage Silo S-01', 7850.20, 15000.0, 'kg', 2000.0),
            ('ADDITIVE', N'Flavor & Vitamins (Hương liệu & Vi chất)', 'TANK-ADD-01', N'Additive Blend Tank A-01', 1240.50, 3000.0, 'L', 400.0)
            """)
            logger.info("Material_Stock seeded.")

        # Seed Customers if empty
        cursor.execute("SELECT COUNT(*) FROM Customers")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
            INSERT INTO Customers (Customer_ID, Customer_Code, Customer_Name, Address, Email, Phone, Priority, Status, ActiveOrders)
            VALUES 
            ('CUS-01', 'CUS-VNM', N'Vinamilk (Vietnam Dairy Products)', N'District 7, HCMC', 'procurement@vinamilk.com.vn', '+84 28 5415 5555', 1, 'Active', 2),
            ('CUS-02', 'CUS-THM', N'TH True Milk Corporation', N'Nghia Dan, Nghe An', 'supply-chain@thmilk.vn', '+84 238 868 8888', 2, 'Active', 1),
            ('CUS-03', 'CUS-NUT', N'Nutifood Nutrition Group', N'Tan Binh District, HCMC', 'orders@nutifood.com.vn', '+84 28 3826 7999', 2, 'Active', 1),
            ('CUS-04', 'CUS-FCS', N'FrieslandCampina Vietnam', N'Binh Duong Province', 'contact@frieslandcampina.com', '+84 274 375 6123', 3, 'Active', 0),
            ('CUS-05', 'CUS-MOC', N'Moc Chau Dairy Cattle JSC', N'Moc Chau, Son La', 'contact@mocchaumilk.com', '+84 212 386 6200', 2, 'Active', 1)
            """)
            logger.info("Customers seeded.")

        # Seed Recipes if empty
        cursor.execute("SELECT COUNT(*) FROM Recipes")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
            INSERT INTO Recipes (Recipe_ID, Recipe_Name, Description, Target_Volume, Temp_Hot, Temp_Cold, Status, Version)
            VALUES 
            ('RCP-MILK-UHT-01', N'Fresh Pasteurized UHT Milk (Sữa tươi tiệt trùng UHT)', N'Standard UHT Whole Milk with direct steam injection', 1000.0, 140.0, 4.0, 'RELEASED', 'v2.4'),
            ('RCP-CHOC-MILK-02', N'Chocolate Flavored Milk (Sữa sô-cô-la chuẩn)', N'Pasteurized chocolate milk with sweetened cocoa dispersion', 1000.0, 75.0, 4.0, 'RELEASED', 'v2.3'),
            ('RCP-YOGURT-DRK-03', N'Probiotic Drinking Yogurt (Sữa chua uống men sống)', N'Cultured probiotic yogurt drink with delicate acid profile', 1000.0, 85.0, 4.0, 'RELEASED', 'v1.9'),
            ('RCP-STRAW-MILK-04', N'Strawberry Milk Drink (Sữa tươi dâu tây)', N'Sweetened strawberry flavored milk drink', 1000.0, 75.0, 4.0, 'RELEASED', 'v1.4')
            """)
            logger.info("Recipes seeded.")

        # Seed Recipe_Detail if empty
        cursor.execute("SELECT COUNT(*) FROM Recipe_Detail")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
            INSERT INTO Recipe_Detail (Recipe_ID, Material_ID, Material_Name, Percentage, Target_Qty, Unit)
            VALUES 
            ('RCP-MILK-UHT-01', 'RAW_MILK', N'Fresh Raw Milk', 95.0, 950.0, 'L'),
            ('RCP-MILK-UHT-01', 'ADDITIVE', N'Vitamin D3 & Stabilizer', 5.0, 50.0, 'L'),
            ('RCP-CHOC-MILK-02', 'RAW_MILK', N'Fresh Raw Milk', 70.0, 700.0, 'L'),
            ('RCP-CHOC-MILK-02', 'SUGAR', N'Refined Cane Sugar', 20.0, 200.0, 'kg'),
            ('RCP-CHOC-MILK-02', 'ADDITIVE', N'Cocoa & Emulsifier', 10.0, 100.0, 'L'),
            ('RCP-YOGURT-DRK-03', 'RAW_MILK', N'Fresh Raw Milk', 80.0, 800.0, 'L'),
            ('RCP-YOGURT-DRK-03', 'SUGAR', N'Refined Cane Sugar', 15.0, 150.0, 'kg'),
            ('RCP-YOGURT-DRK-03', 'ADDITIVE', N'Probiotic Starter Culture', 5.0, 50.0, 'L'),
            ('RCP-STRAW-MILK-04', 'RAW_MILK', N'Fresh Raw Milk', 75.0, 750.0, 'L'),
            ('RCP-STRAW-MILK-04', 'SUGAR', N'Refined Cane Sugar', 15.0, 150.0, 'kg'),
            ('RCP-STRAW-MILK-04', 'ADDITIVE', N'Strawberry Flavor & Color', 10.0, 100.0, 'L')
            """)
            logger.info("Recipe_Detail seeded.")

        conn.close()
        logger.info("Database MES_Milk_Production fully initialized and seeded.")
        return True
    except Exception as e:
        logger.error(f"Error initializing schema in MES_Milk_Production: {e}")
        return False

if __name__ == "__main__":
    init_mes_database()
