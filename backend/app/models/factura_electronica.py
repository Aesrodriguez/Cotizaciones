from sqlalchemy import Column, VARCHAR, Numeric, Boolean, Text, Date, TIMESTAMP, Integer, ForeignKey
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
    # Campos extendidos (migration 016)
    cufe                   = Column(VARCHAR(250))
    tipo_documento         = Column(VARCHAR(10))
    nota                   = Column(Text)
    moneda                 = Column(VARCHAR(10), default='COP')
    forma_pago             = Column(VARCHAR(30))
    dian_validado          = Column(Boolean, nullable=False, default=False)
    dian_respuesta         = Column(VARCHAR(100))
    proveedor_telefono     = Column(VARCHAR(100))
    proveedor_email        = Column(VARCHAR(200))
    proveedor_direccion    = Column(VARCHAR(300))
    proveedor_ciudad       = Column(VARCHAR(100))
    adquiriente_telefono   = Column(VARCHAR(100))
    adquiriente_email      = Column(VARCHAR(200))
    adquiriente_direccion  = Column(VARCHAR(300))
    adquiriente_ciudad     = Column(VARCHAR(100))
    autorizacion_dian      = Column(VARCHAR(60))
    autorizacion_desde     = Column(Date)
    autorizacion_hasta     = Column(Date)
    prefijo                = Column(VARCHAR(20))
    qr_url                 = Column(Text)
    created_at             = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"))
    updated_at             = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"), onupdate=sa.text("NOW()"))


class ItemCatalogoCompras(Base):
    __tablename__ = "items_catalogo_compras"

    id               = Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    referencia       = Column(VARCHAR(100))
    descripcion      = Column(VARCHAR(500), nullable=False)
    unidad           = Column(VARCHAR(20))
    proveedor_nit    = Column(VARCHAR(30))
    proveedor_nombre = Column(VARCHAR(300))
    ultimo_precio    = Column(Numeric(18, 2))
    ultima_compra    = Column(Date)
    total_compras    = Column(Integer, nullable=False, default=1)
    created_at       = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"))
    updated_at       = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"))


class FacturaElectronicaItem(Base):
    __tablename__ = "facturas_electronicas_items"

    id              = Column(UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))
    factura_id      = Column(UUID(as_uuid=True), ForeignKey("facturas_electronicas.id", ondelete="CASCADE"), nullable=False)
    catalogo_item_id = Column(UUID(as_uuid=True), ForeignKey("items_catalogo_compras.id", ondelete="SET NULL"))
    linea_num       = Column(Integer, nullable=False, default=0)
    descripcion     = Column(VARCHAR(500))
    referencia      = Column(VARCHAR(100))
    cantidad        = Column(Numeric(12, 4), nullable=False, default=0)
    unidad          = Column(VARCHAR(20))
    precio_unitario = Column(Numeric(18, 2), nullable=False, default=0)
    subtotal        = Column(Numeric(18, 2), nullable=False, default=0)
    iva_pct         = Column(Numeric(6, 2), nullable=False, default=0)
    iva_monto       = Column(Numeric(18, 2), nullable=False, default=0)
    created_at      = Column(TIMESTAMP, nullable=False, server_default=sa.text("NOW()"))
