"""Persistência local transacional, schema v1. Sem frames de webcam."""

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


@contextmanager
def database():
    root = Path(os.environ.get("HEATCITY_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
    root.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(root / "heatcity.sqlite3", timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    version = connection.execute("PRAGMA user_version").fetchone()[0]
    if version not in (0, 1):
        connection.close()
        raise RuntimeError("Versão do banco não suportada. Preserve o backup antes de migrar.")
    connection.executescript("""
      CREATE TABLE IF NOT EXISTS studies(id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS scenarios(id TEXT PRIMARY KEY, study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE, payload TEXT NOT NULL);
      PRAGMA user_version=1;
    """)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def read(table, identifier):
    assert table in ("studies", "scenarios", "sessions")
    with database() as db:
        row = db.execute(f"SELECT payload FROM {table} WHERE id=?", (identifier,)).fetchone()
        return json.loads(row["payload"]) if row else None


def list_rows(table, parent=None):
    assert table in ("studies", "scenarios", "sessions")
    column = {"scenarios": "study_id", "sessions": "scenario_id"}.get(table)
    with database() as db:
        query = f"SELECT payload FROM {table}"
        rows = db.execute(
            query + (f" WHERE {column}=?" if parent and column else "") + " ORDER BY rowid DESC",
            (parent,) if parent and column else (),
        ).fetchall()
        return [json.loads(row["payload"]) for row in rows]


def insert(table, payload, parent=None):
    assert table in ("studies", "scenarios", "sessions")
    column = {"scenarios": "study_id", "sessions": "scenario_id"}.get(table)
    with database() as db:
        if column:
            db.execute(
                f"INSERT INTO {table}(id,{column},payload) VALUES(?,?,?)",
                (payload["id"], parent, json.dumps(payload)),
            )
        else:
            db.execute(
                f"INSERT INTO {table}(id,payload) VALUES(?,?)", (payload["id"], json.dumps(payload))
            )
    return payload


def finish_session(identifier, payload):
    with database() as db:
        current = db.execute("SELECT payload FROM sessions WHERE id=?", (identifier,)).fetchone()
        if not current or json.loads(current["payload"])["status"] != "running":
            raise ValueError("Sessão já encerrada ou removida.")
        updated = db.execute(
            "UPDATE sessions SET payload=? WHERE id=? AND payload=?",
            (json.dumps(payload), identifier, current["payload"]),
        )
        if updated.rowcount != 1:
            raise ValueError("A sessão foi alterada por outra operação.")
