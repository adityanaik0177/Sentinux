"""
database.py — Core DB layer (PRODUCER)
=======================================
This is the foundational producer. Every other module in the system imports from here.
Changing this file will trigger a LARGE blast radius warning.

F-Score: N/A (pure producer — defines symbols, imports nothing local)
"""

import os
import json
from pathlib import Path


class DatabaseConnection:
    """Manages the database connection pool."""

    def __init__(self, host: str, port: int, db_name: str):
        self.host = host
        self.port = port
        self.db_name = db_name
        self._connected = False

    def connect(self):
        self._connected = True
        print(f"[DB] Connected to {self.host}:{self.port}/{self.db_name}")

    def disconnect(self):
        self._connected = False

    def is_alive(self) -> bool:
        return self._connected


class QueryBuilder:
    """Fluent SQL query builder."""

    def __init__(self):
        self._table = ""
        self._conditions = []
        self._limit = None

    def from_table(self, table: str) -> "QueryBuilder":
        self._table = table
        return self

    def where(self, condition: str) -> "QueryBuilder":
        self._conditions.append(condition)
        return self

    def limit(self, n: int) -> "QueryBuilder":
        self._limit = n
        return self

    def build(self) -> str:
        q = f"SELECT * FROM {self._table}"
        if self._conditions:
            q += " WHERE " + " AND ".join(self._conditions)
        if self._limit:
            q += f" LIMIT {self._limit}"
        return q


class Repository:
    """Generic repository pattern base class."""

    def __init__(self, conn: DatabaseConnection):
        self._conn = conn

    def find_by_id(self, entity_id: int) -> dict:
        raise NotImplementedError

    def save(self, entity: dict) -> bool:
        raise NotImplementedError

    def delete(self, entity_id: int) -> bool:
        raise NotImplementedError


def get_default_connection() -> DatabaseConnection:
    """Factory: return a pre-configured DatabaseConnection."""
    return DatabaseConnection(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "5432")),
        db_name=os.getenv("DB_NAME", "shop_db"),
    )


def run_migration(conn: DatabaseConnection, sql_file: str) -> bool:
    """Read and execute a migration SQL file. Returns True on success."""
    try:
        sql = Path(sql_file).read_text()
        print(f"[Migration] Applying {sql_file} ...")
        return True
    except FileNotFoundError:
        return False
