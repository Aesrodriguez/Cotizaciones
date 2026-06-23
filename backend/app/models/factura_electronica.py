from sqlalchemy import Column, VARCHAR, Numeric, Boolean, Text, Date, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base
import sqlalchemy as sa


class FacturaElectronica(Base):
    __tablename__ = "facturas_electronicas"

    id                 = Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    numero             = Column(VARCHAR(100), nullable=False)
    fecha_emision      = Column(Date, nullable=False)
    proveedor_nit      = Column(VARCHAR(30))
    proveedor_nombre   = Column(VARCHAR(300))
    adquiriente_nit    = Column(VARCHAR(30))
    adquiriente_nombre = Column(VARCHAR(300))
    subtotal           = Column(Numeric(18, 2), nullable=False, default=0)
    iva                = Column(Numeric(18, 2), nullable=False, default=0)
    retefuente         = Column(Numeric(18, 2), nullable=False, default=0)
    reteiva            = Column(Numeric(18, 2), nullable=False, default=0)
    reteica            = Column(Numeric(18, 2), nullable=False, default=0)
    total_bruto        = Column(Numeric(18, 2), nullable=False, default=0)
    total_pagar        = Column(Numeric(18, 2), nullable=False, default=0)
    tiene_retencion    = Column(Boolean, nullable=False, default=False)
    estado             = Column(VARCHAR(30), nullable=False, default="RECIBIDA")
    xml_filename       = Column(VARCHAR(255))
    xml_content        = Column(Text)
    observaciones      = Column(Text)
    created_at         = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"))
    updated_at         = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"), onupdate=sa.text("NOW()"))
