import { useState } from 'react'

const MESES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
]

type Territorial = 'BOGOTA' | 'CUNDINAMARCA' | 'AMBAS'

function formatFecha(date: Date) {
  return {
    dia: date.getDate(),
    mes: MESES[date.getMonth()],
    anio: date.getFullYear(),
  }
}

function CartaContenido({ territorial, fecha }: { territorial: Exclude<Territorial, 'AMBAS'>; fecha: Date }) {
  const { dia, mes, anio } = formatFecha(fecha)
  const nombreTerritorial = territorial === 'BOGOTA'
    ? 'Dirección Territorial De Bogotá'
    : 'Dirección Territorial De Cundinamarca'

  return (
    <div className="carta-cuerpo">
      {/* Encabezado */}
      <div className="carta-header">
        <div className="carta-empresa">
          <p className="empresa-nombre">TRIPLE A CONSTRUCCIONES SAS</p>
          <p className="empresa-nit">NIT 901.650.581-4</p>
        </div>
      </div>

      <div className="carta-fecha">
        <p>Bogotá D.C {dia} de {mes} de {anio}</p>
      </div>

      <div className="carta-destinatario">
        <p>Señores</p>
        <p><strong>Ministerio de Trabajo</strong></p>
        <p>{nombreTerritorial}</p>
        <p>CIUDAD</p>
      </div>

      <div className="carta-asunto">
        <p><strong>Asunto:</strong> Solicitud Certificado Paz y Salvo Laboral</p>
      </div>

      <div className="carta-cuerpo-texto">
        <p>
          Yo <strong>ANDRES ESTEBAN RODRIGUEZ QUEVEDO</strong> identificado con cedula de ciudadanía
          N° <strong>1.000.517.834</strong> de Madrid, actuando en calidad de Representante Legal de
          la sociedad <strong>TRIPLE A CONSTRUCCIONES SAS</strong> identificada con{' '}
          <strong>Nit 901.650.581-4</strong>, me permito solicitar Certificado de reclamaciones,
          investigaciones administrativo laborales y sanciones. (paz y salvo) de la empresa a la
          que represento.
        </p>
      </div>

      <div className="carta-cierre">
        <p>
          La presente solicitud se firma en Bogotá D.C a los {dia} días del mes de {mes} del año {anio}.
        </p>
      </div>

      <div className="carta-adjuntos">
        <p><strong>Adjuntos:</strong></p>
        <ul>
          <li>Certificado de cámara y comercio</li>
          <li>Fotocopia del documento de identidad</li>
        </ul>
      </div>

      <div className="carta-firma">
        <div className="firma-linea" />
        <p><strong>ANDRES RODRIGUEZ</strong></p>
        <p>C.C 1.000.517.834</p>
        <p>REPRESENTANTE LEGAL</p>
        <p>TRIPLE A CONSTRUCCIONES SAS</p>
        <p>Nit 901.650.581-4</p>
      </div>
    </div>
  )
}

export default function CartaSolicitudPage() {
  const hoy = new Date()
  const [fechaStr, setFechaStr] = useState(hoy.toISOString().slice(0, 10))
  const [territorial, setTerritorial] = useState<Territorial>('BOGOTA')

  const fecha = new Date(fechaStr + 'T12:00:00')

  const handlePrint = () => window.print()

  return (
    <>
      <style>{`
        /* ── Pantalla ── */
        .carta-page { max-width: 860px; margin: 0 auto; padding: 24px; }

        .carta-controles {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 24px;
          padding: 16px 20px;
          border-radius: 8px;
          background: var(--bg-card, #f9f9f9);
          border: 1px solid var(--border, #e0e0e0);
        }
        .carta-controles label { font-size: 13px; font-weight: 600; color: var(--text-faint, #666); }
        .carta-controles input[type="date"],
        .carta-controles select {
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--border, #ccc);
          background: var(--bg, #fff);
          color: var(--text, #111);
          font-size: 14px;
        }
        .btn-print {
          margin-left: auto;
          padding: 8px 20px;
          border-radius: 6px;
          border: none;
          background: #2563eb;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-print:hover { background: #1d4ed8; }

        .cartas-wrapper { display: flex; flex-direction: column; gap: 32px; }

        /* ── Carta individual ── */
        .carta-cuerpo {
          background: #fff;
          color: #111;
          padding: 48px 56px;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          font-family: 'Times New Roman', Times, serif;
          font-size: 14px;
          line-height: 1.75;
          page-break-after: always;
        }
        .carta-header {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 32px;
          padding-bottom: 16px;
          border-bottom: 2px solid #111;
        }
        .carta-empresa { text-align: right; }
        .empresa-nombre { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
        .empresa-nit { font-size: 12px; color: #444; }

        .carta-fecha { margin-bottom: 24px; }

        .carta-destinatario {
          margin-bottom: 20px;
          line-height: 1.6;
        }

        .carta-asunto {
          margin-bottom: 20px;
          padding: 8px 12px;
          background: #f5f5f5;
          border-left: 3px solid #2563eb;
        }

        .carta-cuerpo-texto { margin-bottom: 20px; text-align: justify; }

        .carta-cierre { margin-bottom: 20px; }

        .carta-adjuntos { margin-bottom: 32px; }
        .carta-adjuntos ul { margin: 4px 0 0 20px; }

        .carta-firma { margin-top: 48px; }
        .firma-linea {
          width: 200px;
          border-top: 1px solid #111;
          margin-bottom: 8px;
        }

        /* ── Impresión ── */
        @media print {
          .carta-controles { display: none !important; }
          .carta-page { padding: 0; max-width: 100%; }
          .cartas-wrapper { gap: 0; }
          .carta-cuerpo {
            border: none;
            border-radius: 0;
            padding: 30mm 25mm;
            page-break-after: always;
            box-shadow: none;
          }
        }
      `}</style>

      <div className="carta-page">
        <div className="carta-controles">
          <label>Fecha</label>
          <input
            type="date"
            value={fechaStr}
            onChange={e => setFechaStr(e.target.value)}
          />

          <label>Territorial</label>
          <select value={territorial} onChange={e => setTerritorial(e.target.value as Territorial)}>
            <option value="BOGOTA">Bogotá</option>
            <option value="CUNDINAMARCA">Cundinamarca</option>
            <option value="AMBAS">Ambas (imprimir las dos)</option>
          </select>

          <button className="btn-print" onClick={handlePrint}>
            Imprimir / Guardar PDF
          </button>
        </div>

        <div className="cartas-wrapper">
          {(territorial === 'BOGOTA' || territorial === 'AMBAS') && (
            <CartaContenido territorial="BOGOTA" fecha={fecha} />
          )}
          {(territorial === 'CUNDINAMARCA' || territorial === 'AMBAS') && (
            <CartaContenido territorial="CUNDINAMARCA" fecha={fecha} />
          )}
        </div>
      </div>
    </>
  )
}
