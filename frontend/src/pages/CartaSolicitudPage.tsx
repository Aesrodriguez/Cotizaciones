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
      {/* Marca de agua en COLOR */}
      <div className="marca-agua" aria-hidden="true">
        <img src="/Logo.jpeg" alt="" />
      </div>

      {/* Encabezado: título grande izquierda, logo derecha */}
      <div className="carta-header">
        <h1 className="carta-titulo">TRIPLE A CONSTRUCCIONES SAS</h1>
        <img src="/Logo.jpeg" alt="Triple A Construcciones" className="carta-logo" />
      </div>

      <p className="carta-fecha">Bogotá D.C {dia} de {mes} de {anio}</p>

      <div className="carta-destinatario">
        <p><strong>Señores:</strong></p>
        <p><strong>Ministerio de Trabajo</strong></p>
        <p><strong>{nombreTerritorial}</strong></p>
        <p>CIUDAD</p>
      </div>

      <p className="carta-saludo">Cordial Saludo</p>

      <div className="carta-cuerpo-texto">
        <p>
          Yo <strong>ANDRES ESTEBAN RODRIGUEZ QUEVEDO</strong> identificado con cedula de
          ciudadanía N° <strong>1.000.517.834</strong> de Madrid, actuando en calidad de
          Representante Legal de la sociedad <strong>TRIPLE A CONSTRUCCIONES SAS</strong>{' '}
          identificada con <strong>Nit 901.650.581-4,</strong> me permito solicitar Certificado
          de reclamaciones, investigaciones administrativo laborales y sanciones. (paz y salvo)
          de la empresa a la que represento.
        </p>
      </div>

      <div className="carta-cierre">
        <p>
          La presente solicitud se firma en Bogotá D.C a los {dia} días del mes de {mes} del
          año {anio}.
        </p>
      </div>

      <div className="carta-adjuntos">
        <p>Adjunto a este documento:</p>
        <p>certificado de cámara y comercio</p>
        <p>Fotocopia del documento de identidad</p>
      </div>

      <div className="carta-firma">
        <img src="/Firma.jpg" alt="Firma" className="firma-imagen" />
        <div className="firma-linea" />
        <p><strong>ANDRES RODRIGUEZ</strong></p>
        <p><strong>C.C 1.000.517.834</strong></p>
        <p>REPRESENTANTE LEGAL</p>
        <p><strong>TRIPLE A CONSTRUCCIONES SAS</strong></p>
        <p><strong>Nit 901.650.581-4</strong></p>
      </div>
    </div>
  )
}

export default function CartaSolicitudPage() {
  const hoy = new Date()
  const [fechaStr, setFechaStr] = useState(hoy.toISOString().slice(0, 10))
  const [territorial, setTerritorial] = useState<Territorial>('BOGOTA')

  const fecha = new Date(fechaStr + 'T12:00:00')

  return (
    <>
      <style>{`
        /* ── Controles ── */
        .carta-page { max-width: 820px; margin: 0 auto; padding: 24px; }

        .carta-controles {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 24px;
          padding: 14px 18px;
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

        /* ── Hoja ── */
        .carta-cuerpo {
          position: relative;
          background: #fff;
          color: #111;
          padding: 52px 64px 56px;
          border: 1px solid #d0d0d0;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 13.5px;
          line-height: 1.6;
          overflow: hidden;
        }

        /* Marca de agua — en COLOR */
        .marca-agua {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-20%, -48%);
          pointer-events: none;
          z-index: 0;
        }
        .marca-agua img {
          width: 340px;
          opacity: 0.13;
          /* sin grayscale → conserva colores */
        }

        /* Todo el contenido sobre la marca */
        .carta-cuerpo > *:not(.marca-agua) { position: relative; z-index: 1; }

        /* Encabezado */
        .carta-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 20px;
        }
        .carta-titulo {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.3px;
          margin: 0;
          color: #111;
        }
        .carta-logo {
          height: 72px;
          width: auto;
          object-fit: contain;
          flex-shrink: 0;
        }

        /* Fecha */
        .carta-fecha {
          margin: 0 0 32px;
          font-size: 13.5px;
        }

        /* Destinatario */
        .carta-destinatario {
          margin-bottom: 28px;
          line-height: 1.55;
        }
        .carta-destinatario p { margin: 0; }

        /* Saludo */
        .carta-saludo {
          margin: 0 0 28px;
          font-size: 13.5px;
        }

        /* Cuerpo */
        .carta-cuerpo-texto {
          margin-bottom: 28px;
          text-align: justify;
        }
        .carta-cuerpo-texto p { margin: 0; }

        /* Cierre */
        .carta-cierre {
          margin-bottom: 28px;
          text-align: justify;
        }
        .carta-cierre p { margin: 0; }

        /* Adjuntos */
        .carta-adjuntos {
          margin-bottom: 32px;
          line-height: 1.7;
        }
        .carta-adjuntos p { margin: 0; }

        /* Firma */
        .carta-firma { margin-top: 8px; }
        .firma-imagen {
          display: block;
          height: 88px;
          width: auto;
          object-fit: contain;
          margin-bottom: 0;
        }
        .firma-linea {
          width: 260px;
          border-top: 1.5px solid #111;
          margin-bottom: 6px;
        }
        .carta-firma p { margin: 0; line-height: 1.55; }

        /* ── Impresión ── */
        @media print {
          .carta-controles { display: none !important; }
          .carta-page { padding: 0; max-width: 100%; }
          .cartas-wrapper { gap: 0; }
          .carta-cuerpo {
            border: none;
            padding: 22mm 22mm 26mm;
            page-break-after: always;
            box-shadow: none;
          }
          .marca-agua img {
            opacity: 0.13 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
          <button className="btn-print" onClick={() => window.print()}>
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
