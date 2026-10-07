import sqlite3
import pyodbc
import time
import os
import threading
from datetime import datetime

# Chuỗi kết nối trực tiếp vào SQL Server của máy bạn
SQL_SERVER_CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost\\WINCC;"
    "DATABASE=MES_Milk_Production;"
    "Trusted_Connection=yes;"
    "TrustServerCertificate=yes;"
    "Connection Timeout=2;"  # Timeout 2 giây để chuyển mạch sang SQLite ngay khi SQL mất kết nối
)

# File cơ sở dữ liệu đệm SQLite sẽ nằm cùng thư mục backend
BUFFER_DB_PATH = os.path.join(os.path.dirname(__file__), "buffer_storage.db")

class StoreAndForwardEngine:
    def __init__(self):
        self.is_sql_online = False
        self.lock = threading.Lock()
        self._init_sqlite_buffer()
        # Probe initial connection state
        conn = self.get_sql_connection()
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        # Khởi chạy luồng ngầm tự động thăm dò và đẩy bù dữ liệu khi SQL phục hồi
        self.sync_thread = threading.Thread(target=self._recovery_and_flush_worker, daemon=True)
        self.sync_thread.start()

    def _init_sqlite_buffer(self):
        """Khởi tạo bảng đệm trong file SQLite nếu chưa có"""
        with sqlite3.connect(BUFFER_DB_PATH) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS buffer_plc_datalog (
                    buffer_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    OrderCode TEXT,
                    TagName TEXT NOT NULL,
                    Value REAL NOT NULL,
                    Unit TEXT,
                    ReadTime TEXT NOT NULL,
                    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def get_sql_connection(self):
        """Kiểm tra và lấy kết nối đến Microsoft SQL Server"""
        try:
            conn = pyodbc.connect(SQL_SERVER_CONN_STR)
            self.is_sql_online = True
            return conn
        except Exception:
            self.is_sql_online = False
            return None

    def log_datalog(self, order_code: str, tag_name: str, value: float, unit: str = "°C", read_time: str = None):
        """
        Ghi dữ liệu vận hành:
        - Nếu SQL Server chạy: Ghi thẳng vào SQL Server.
        - Nếu SQL Server tắt/mất kết nối: Tự động rẽ nhánh ghi vào SQLite buffer.
        """
        if not read_time:
            read_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        conn = self.get_sql_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO dbo.PLC_Datalog (OrderCode, TagName, Value, Unit, ReadTime) VALUES (?, ?, ?, ?, ?)",
                    (order_code, tag_name, value, unit, read_time)
                )
                conn.commit()
                conn.close()
                return "INSERTED_SQL_SERVER"
            except Exception:
                conn.close()
                self.is_sql_online = False

        # RẼ NHÁNH VÀO SQLITE KHI SQL SERVER KHÔNG PHẢN HỒI
        with self.lock:
            with sqlite3.connect(BUFFER_DB_PATH) as sqlite_conn:
                cur = sqlite_conn.cursor()
                cur.execute(
                    "INSERT INTO buffer_plc_datalog (OrderCode, TagName, Value, Unit, ReadTime) VALUES (?, ?, ?, ?, ?)",
                    (order_code, tag_name, value, unit, read_time)
                )
                sqlite_conn.commit()
        return "BUFFERED_SQLITE"

    def get_pending_buffer_count(self) -> int:
        """Đếm số bản ghi đang chờ trong bộ đệm SQLite"""
        try:
            with sqlite3.connect(BUFFER_DB_PATH) as conn:
                cur = conn.cursor()
                cur.execute("SELECT COUNT(*) FROM buffer_plc_datalog")
                row = cur.fetchone()
                return int(row[0]) if row else 0
        except Exception:
            return 0

    def _recovery_and_flush_worker(self):
        """Tiến trình ngầm: Quét mỗi 3 giây, kiểm tra kết nối và nếu SQL bật lại thì tự động bơm bù dữ liệu"""
        while True:
            try:
                time.sleep(3)
                pending_count = self.get_pending_buffer_count()

                sql_conn = self.get_sql_connection()
                if sql_conn:
                    if pending_count > 0:
                        self._flush_buffer_to_sql_server(sql_conn)
                    try:
                        sql_conn.close()
                    except Exception:
                        pass
            except Exception:
                pass

    def _flush_buffer_to_sql_server(self, sql_conn):
        """Đọc từ SQLite đẩy vào SQL Server theo thứ tự thời gian (FIFO) rồi xóa buffer"""
        with self.lock:
            with sqlite3.connect(BUFFER_DB_PATH) as sqlite_conn:
                s_cur = sqlite_conn.cursor()
                s_cur.execute("SELECT buffer_id, OrderCode, TagName, Value, Unit, ReadTime FROM buffer_plc_datalog ORDER BY buffer_id ASC LIMIT 500")
                rows = s_cur.fetchall()

                if not rows:
                    return

                sql_cursor = sql_conn.cursor()
                buffer_ids_to_delete = []

                try:
                    for row in rows:
                        b_id, o_code, tag, val, unit, r_time = row
                        sql_cursor.execute(
                            "INSERT INTO dbo.PLC_Datalog (OrderCode, TagName, Value, Unit, ReadTime) VALUES (?, ?, ?, ?, ?)",
                            (o_code, tag, val, unit, r_time)
                        )
                        buffer_ids_to_delete.append(b_id)

                    sql_conn.commit()

                    # Xóa các dòng đã đồng bộ thành công khỏi SQLite
                    placeholders = ",".join("?" for _ in buffer_ids_to_delete)
                    s_cur.execute(f"DELETE FROM buffer_plc_datalog WHERE buffer_id IN ({placeholders})", buffer_ids_to_delete)
                    sqlite_conn.commit()
                except Exception:
                    sql_conn.rollback()

db_engine = StoreAndForwardEngine()