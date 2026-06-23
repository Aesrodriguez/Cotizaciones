from sqlalchemy import Column, VARCHAR, Numeric, Integer, Text, Date, Time, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import ForeignKey
from app.models.base import Base
import sqlalchemy as sa


class ExtractoBancario(Base):
    __tablename__ = "extractos_bancarios"

    id              = Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    nombre_archivo  = Column(VARCHAR(255), nullable=False)
    cuenta          = Column(VARCHAR(30))
    periodo         = Column(VARCHAR(7))
    saldo_inicial   = Column(Numeric(18, 2))
    saldo_final     = Column(Numeric(18, 2))
    total_creditos  = Column(Numeric(18, 2), default=0)
    total_debitos   = Column(Numeric(18, 2), default=0)
    num_movimientos = Column(Integer, default=0)
    observaciones   = Column(Text)
    created_at      = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"))


class ExtractoBancarioMovimiento(Base):
    __tablename__ = "extractos_bancarios_movimientos"

    id                   = Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    extracto_id          = Column(UUID(as_uuid=True), ForeignKey("extractos_bancarios.id", ondelete="CASCADE"), nullable=False)
    tipo                 = Column(VARCHAR(10), nullable=False)
    tipo_codigo          = Column(VARCHAR(10))
    fecha                = Column(Date, nullable=False)
    fecha_aplicacion     = Column(Date)
    hora                 = Column(Time)
    oficina              = Column(VARCHAR(10))
    consecutivo          = Column(VARCHAR(20))
    valor                = Column(Numeric(18, 2), nullable=False)
    valor_con_cargos     = Column(Numeric(18, 2))
    banco_codigo         = Column(VARCHAR(10))
    codigo_servicio      = Column(VARCHAR(10))
    descripcion_servicio = Column(VARCHAR(80))
    cuenta_ref1          = Column(VARCHAR(25))
    cuenta_ref2          = Column(VARCHAR(25))
    saldo                = Column(Numeric(18, 2))
    referencia           = Column(VARCHAR(30))
    clasificacion        = Column(VARCHAR(40))
    created_at           = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"))
