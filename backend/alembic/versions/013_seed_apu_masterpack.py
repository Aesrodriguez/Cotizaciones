"""Seed APU data from Master Pack Colombia 2026.

Revision ID: 013
Revises: 012
"""
import json
import os
from alembic import op
from sqlalchemy import text

revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None

DATA_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    '..', '..', 'app', 'data', 'apu_seed.json'
)

_BATCH = 500


def _esc(s: str) -> str:
    return s.replace("'", "''") if s else ''


def upgrade():
    if not os.path.exists(DATA_FILE):
        print(f"[013] Seed file not found: {DATA_FILE}. Skipping.")
        return

    with open(DATA_FILE, encoding='utf-8') as f:
        seed = json.load(f)

    conn = op.get_bind()

    # Check if already seeded
    result = conn.execute(text("SELECT COUNT(*) FROM apu WHERE capitulo_codigo IS NOT NULL"))
    if result.scalar() > 0:
        print("[013] APU data already seeded. Skipping.")
        return

    apus = seed['apus']
    print(f"[013] Seeding {len(apus)} APUs...")

    mat_rows, equ_rows, mob_rows = [], [], []

    for apu in apus:
        code = _esc(apu['code'])
        nombre = _esc(apu['nombre'])
        unidad = _esc(apu['unidad'])
        precio = apu.get('precio', 0) or 0
        cap_code = _esc(apu.get('cap_code', ''))
        cap_name = _esc(apu.get('cap_name', ''))

        # Upsert APU row — use ON CONFLICT to skip duplicates
        conn.execute(text(f"""
            INSERT INTO apu (id, codigo, nombre, unidad_medida, precio_unitario,
                             capitulo_codigo, capitulo, estado,
                             created_at, updated_at)
            VALUES (gen_random_uuid(), '{code}', '{nombre}', '{unidad}', {precio},
                    '{cap_code}', '{cap_name}', 'ACTIVO',
                    NOW(), NOW())
            ON CONFLICT (codigo) DO UPDATE
              SET capitulo_codigo = EXCLUDED.capitulo_codigo,
                  capitulo        = EXCLUDED.capitulo,
                  precio_unitario = EXCLUDED.precio_unitario
        """))

        for i, r in enumerate(apu.get('mat', [])):
            if r.get('c') and r['c'] > 0:
                mat_rows.append((code, _esc(r['d']), _esc(r['u']), r['c'], r['p'], r['v'], i))
        for i, r in enumerate(apu.get('equ', [])):
            if r.get('c') and r['c'] > 0:
                equ_rows.append((code, _esc(r['d']), _esc(r['u']), r['c'], r['p'], r['v'], i))
        for i, r in enumerate(apu.get('mob', [])):
            if r.get('c') and r['c'] > 0:
                mob_rows.append((code, _esc(r['d']), _esc(r['u']), r['c'], r['p'], r['v'], i))

    def _bulk_insert(table: str, rows: list, label: str):
        if not rows: return
        for start in range(0, len(rows), _BATCH):
            batch = rows[start:start + _BATCH]
            values = ', '.join(
                f"(gen_random_uuid(), (SELECT id FROM apu WHERE codigo='{r[0]}' LIMIT 1), "
                f"'{r[1]}', '{r[2]}', {r[3]}, {r[4]}, {r[5]}, {r[6]}, NOW(), NOW())"
                for r in batch
            )
            conn.execute(text(f"""
                INSERT INTO {table}
                  (id, apu_id, descripcion, unidad, cantidad, precio_unitario, subtotal, orden, created_at, updated_at)
                VALUES {values}
            """))
        print(f"[013]   {label}: {len(rows)} rows inserted")

    # Delete existing details before re-inserting (in case of re-run)
    for tbl in ('apu_materiales', 'apu_mano_obra', 'apu_equipos'):
        conn.execute(text(f"DELETE FROM {tbl}"))

    # apu_materiales uses 'nombre' column
    def _bulk_mat(rows: list):
        if not rows: return
        for start in range(0, len(rows), _BATCH):
            batch = rows[start:start + _BATCH]
            values = ', '.join(
                f"(gen_random_uuid(), (SELECT id FROM apu WHERE codigo='{r[0]}' LIMIT 1), "
                f"'{r[1]}', '{r[2]}', {r[3]}, {r[4]}, {r[5]}, {r[6]}, NOW(), NOW())"
                for r in batch
            )
            conn.execute(text(f"""
                INSERT INTO apu_materiales
                  (id, apu_id, nombre, unidad, cantidad, precio_unitario, subtotal, orden, created_at, updated_at)
                VALUES {values}
            """))
        print(f"[013]   materiales: {len(rows)} rows inserted")

    _bulk_mat(mat_rows)
    _bulk_insert('apu_mano_obra', mob_rows, 'mano_obra')
    _bulk_insert('apu_equipos',   equ_rows, 'equipos')

    print("[013] APU seed complete.")


def downgrade():
    op.execute(text("DELETE FROM apu_materiales"))
    op.execute(text("DELETE FROM apu_mano_obra"))
    op.execute(text("DELETE FROM apu_equipos"))
    op.execute(text("DELETE FROM apu WHERE capitulo_codigo IS NOT NULL"))
