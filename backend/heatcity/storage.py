"""Catálogo SQLite v2. Migra imagens/recortes; remove sessões do domínio anterior."""

import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

TABLES = ("projects", "reference_images")


@contextmanager
def database():
    root = Path(os.environ.get("HEATCITY_DATA_DIR", Path(__file__).resolve().parents[2] / "data"))
    root.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(root / "heatcity.sqlite3", timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    try:
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        if version not in (0, 1, 2):
            raise RuntimeError("Versão do banco não suportada.")
        if version in (0, 1):
            connection.execute("BEGIN IMMEDIATE")
            if version == 1:
                connection.execute("DROP TABLE IF EXISTS sessions")
                connection.execute("ALTER TABLE studies RENAME TO projects")
                connection.execute("ALTER TABLE scenarios RENAME TO reference_images")
                connection.execute(
                    "ALTER TABLE reference_images RENAME COLUMN study_id TO project_id"
                )
                for row in connection.execute("SELECT id,payload FROM projects").fetchall():
                    old = json.loads(row["payload"])
                    value = {
                        k: old[k] for k in ("id", "title", "objective", "created_at") if k in old
                    }
                    connection.execute(
                        "UPDATE projects SET payload=? WHERE id=?", (json.dumps(value), row["id"])
                    )
                for row in connection.execute(
                    "SELECT id,project_id,payload FROM reference_images"
                ).fetchall():
                    old = json.loads(row["payload"])
                    value = {
                        k: old[k]
                        for k in (
                            "id",
                            "name",
                            "created_at",
                            "image",
                            "width",
                            "height",
                            "plates",
                            "image_metrics",
                        )
                        if k in old
                    }
                    value["project_id"] = row["project_id"]
                    connection.execute(
                        "UPDATE reference_images SET payload=? WHERE id=?",
                        (json.dumps(value), row["id"]),
                    )
            else:
                connection.execute(
                    "CREATE TABLE projects(id TEXT PRIMARY KEY, payload TEXT NOT NULL)"
                )
                connection.execute(
                    "CREATE TABLE reference_images(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, payload TEXT NOT NULL)"
                )
            connection.execute("PRAGMA user_version=2")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def read(table, identifier):
    assert table in TABLES
    with database() as db:
        row = db.execute(f"SELECT payload FROM {table} WHERE id=?", (identifier,)).fetchone()
        return json.loads(row["payload"]) if row else None


def list_rows(table, parent=None):
    assert table in TABLES
    with database() as db:
        condition = " WHERE project_id=?" if parent and table == "reference_images" else ""
        rows = db.execute(
            f"SELECT payload FROM {table}{condition} ORDER BY rowid DESC",
            (parent,) if condition else (),
        ).fetchall()
        return [json.loads(row["payload"]) for row in rows]


def insert(table, payload, parent=None):
    assert table in TABLES
    with database() as db:
        if table == "reference_images":
            db.execute(
                "INSERT INTO reference_images(id,project_id,payload) VALUES(?,?,?)",
                (payload["id"], parent, json.dumps(payload)),
            )
        else:
            db.execute(
                "INSERT INTO projects(id,payload) VALUES(?,?)", (payload["id"], json.dumps(payload))
            )
    return payload
