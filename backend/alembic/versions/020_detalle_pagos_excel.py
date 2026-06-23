"""Tablas de detalle de pagos y transferencias desde Excel Bancolombia

Revision ID: 020
Revises: 019
Create Date: 2026-06-23
"""
from alembic import op

revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    # Detalle de pagos (hoja Logs_pagos)
    op.execute("""
        CREATE TABLE IF NOT EXISTS detalle_pagos (
            id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            archivo                     VARCHAR(255),
            proceso                     VARCHAR(25) NOT NULL,
            servicio                    VARCHAR(20),   -- PROV | NOMI
            nombre_servicio             VARCHAR(100),
            descripcion_pago            VARCHAR(300),
            tipo_producto_origen        VARCHAR(60),
            producto_origen             VARCHAR(40),
            fecha_pago_actualizacion    DATE,
            estado                      VARCHAR(30),
            fecha_creacion              DATE,
            usuario_creacion            VARCHAR(120),
            usuario_aprueba_1           VARCHAR(120),
            usuario_aprueba_2           VARCHAR(120),
            nit_destino                 VARCHAR(30),
            nombre_destinatario         VARCHAR(300),
            tipo_producto_destino       VARCHAR(60),
            producto_destino            VARCHAR(40),
            numero_convenio             VARCHAR(40),
            fecha_pago                  DATE,
            referencia_destino          VARCHAR(120),
            numero_referencia_destino   VARCHAR(120),
            monto                       NUMERIC(18,2),
            banco_destino               VARCHAR(15),
            estado_registro             VARCHAR(30),
            causal_rechazo              VARCHAR(300),
            created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_dp_proceso ON detalle_pagos(proceso)")

    # Detalle de transferencias (hoja Logs_transferencias)
    op.execute("""
        CREATE TABLE IF NOT EXISTS detalle_transferencias (
            id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            archivo                     VARCHAR(255),
            proceso                     VARCHAR(25) NOT NULL,
            servicio                    VARCHAR(20),   -- TRCN | TRCI
            nombre_servicio             VARCHAR(100),
            tipo_producto_origen        VARCHAR(60),
            producto_origen             VARCHAR(40),
            fecha_pago_actualizacion    DATE,
            nit_destino                 VARCHAR(30),
            nombre_destino              VARCHAR(300),
            fecha_creacion              DATE,
            usuario_creacion            VARCHAR(120),
            usuario_aprueba             VARCHAR(120),
            fecha_modificacion          DATE,
            tipo_producto_destino       VARCHAR(60),
            producto_destino            VARCHAR(40),
            banco_destino               VARCHAR(15),
            monto                       NUMERIC(18,2),
            estado                      VARCHAR(30),
            causal_rechazo              VARCHAR(300),
            created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_dt_proceso ON detalle_transferencias(proceso)")


def downgrade():
    op.execute("DROP TABLE IF EXISTS detalle_pagos")
    op.execute("DROP TABLE IF EXISTS detalle_transferencias")
