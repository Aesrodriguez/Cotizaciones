"""
Database models for Triplaa Cotizaciones.

This module exports all SQLAlchemy ORM models organized by domain:
- base: Base classes and mixins (Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin)
- auth: User, Role, Permission models (Usuario, Rol, Permiso)
- cliente: Customer and Product models (Cliente, Producto)
- cotizacion: Quotation models (Cotizacion, CotizacionItem, CotizacionCalculo, CotizacionHistorial)
- apu: Unit Price Analysis models (APU, APUMaterial, APUManoObra, APUEquipo)
- contrato: Contract, Expense, Worker models (Contrato, Gasto, Trabajador, TrabajadorPago)
- audit: Audit logging and system parameter models (AuditLog, Notificacion, ParametroSistema, Secuencia)
"""

from .base import Base, UUIDPrimaryKey, TimestampedMixin, SoftDeleteMixin

# Authentication & Authorization
from .auth import (
    Usuario, Rol, Permiso, EstadoUsuario,
    rol_permiso, usuario_rol
)

# Customers & Products
from .cliente import (
    Cliente, Producto,
    EstadoCliente, EstadoProducto
)

# Quotations
from .cotizacion import (
    Cotizacion, CotizacionItem, CotizacionCalculo, CotizacionHistorial,
    EstadoCotizacion
)

# APU (Unit Price Analysis)
from .apu import (
    APU, APUMaterial, APUManoObra, APUEquipo,
    EstadoAPU
)

# Contracts, Expenses, Workers
from .contrato import (
    Contrato, Gasto, Trabajador, TrabajadorPago,
    TrabajadorAsignacion, TrabajadorCorte, TrabajadorCorteDetalle, TrabajadorSoporte,
    EstadoContrato, EstadoGasto, EstadoTrabajador, EstadoAsignacion,
    ContratoCapitulo, ContratoItem, ContratoEjecucion,
    ContratoActa, ContratoPago, ContratoGasto,
    EstadoActa, CategoriaGastoContrato,
)

# Actas de Corte de Pago
from .acp import ContratoAcp, ContratoAcpItem

# Audit & System
from .audit import (
    AuditLog, Notificacion, ParametroSistema, Secuencia,
    TipoNotificacion
)

__all__ = [
    # Base
    "Base",
    "UUIDPrimaryKey",
    "TimestampedMixin",
    "SoftDeleteMixin",
    # Auth
    "Usuario",
    "Rol",
    "Permiso",
    "EstadoUsuario",
    "rol_permiso",
    "usuario_rol",
    # Cliente & Products
    "Cliente",
    "Producto",
    "EstadoCliente",
    "EstadoProducto",
    # Quotations
    "Cotizacion",
    "CotizacionItem",
    "CotizacionCalculo",
    "CotizacionHistorial",
    "EstadoCotizacion",
    # APU
    "APU",
    "APUMaterial",
    "APUManoObra",
    "APUEquipo",
    "EstadoAPU",
    # Contracts & Workers
    "Contrato",
    "Gasto",
    "Trabajador",
    "TrabajadorPago",
    "TrabajadorAsignacion",
    "TrabajadorCorte",
    "TrabajadorCorteDetalle",
    "TrabajadorSoporte",
    "EstadoContrato",
    "EstadoGasto",
    "EstadoTrabajador",
    "EstadoAsignacion",
    # Construction contract management
    "ContratoCapitulo",
    "ContratoItem",
    "ContratoEjecucion",
    "ContratoActa",
    "ContratoPago",
    "ContratoGasto",
    "EstadoActa",
    "CategoriaGastoContrato",
    # Audit & System
    "AuditLog",
    "Notificacion",
    "ParametroSistema",
    "Secuencia",
    "TipoNotificacion",
    # ACP
    "ContratoAcp",
    "ContratoAcpItem",
]
