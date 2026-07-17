import { useState } from 'react'
import { publicAPI } from '../services/api'

const TIPOS_DOC = ['CC', 'CE', 'Pasaporte', 'TI', 'PEP']
const TIPOS_TRAB = ['Empleado', 'Subcontratista']
const GENEROS = ['Masculino', 'Femenino', 'Otro']
const ESTADOS_CIVILES = ['Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a', 'Viudo/a']
const NIVELES_EDU = ['Primaria', 'Bachillerato', 'Técnico', 'Tecnólogo', 'Profesional', 'Posgrado']
const RELACIONES = ['Cónyuge', 'Padre/Madre', 'Hijo/Hija', 'Hermano/Hermana', 'Otro']
const TIPOS_CUENTA = ['Ahorros', 'Corriente']

interface Familiar { nombre: string; relacion: string; fecha_nacimiento: string; telefono: string }

const emptyFamiliar = (): Familiar => ({ nombre: '', relacion: '', fecha_nacimiento: '', telefono: '' })

type Step = 1 | 2 | 3 | 4 | 5

export default function RegistroTrabajadorPage() {
  const [step, setStep] = useState<Step>(1)
  const [sending, setSending] = useState(false)
  const [codigoAsignado, setCodigoAsignado] = useState('')

  // ── Campos del formulario ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    // 1. Personales
    nombres: '', apellidos: '', tipo_documento: 'CC', cedula: '',
    fecha_nacimiento: '', genero: '', estado_civil: '', nivel_educativo: '',
    telefono: '', email: '', ciudad: '', direccion: '', numero_hijos: '',
    // 2. Laborales
    cargo: '', especialidad: '', tipo: 'Empleado', fecha_ingreso: '',
    // 3. Seguridad social
    eps: '', fondo_pension: '', arl: '', caja_compensacion: '',
    // 4. Bancarios
    banco: '', tipo_cuenta: 'Ahorros', numero_cuenta: '',
    // 4b. Contacto emergencia
    contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', contacto_emergencia_relacion: '',
  })
  const [familiares, setFamiliares] = useState<Familiar[]>([])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // ── Validaciones por paso ─────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (s: Step): boolean => {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.nombres.trim()) e.nombres = 'Requerido'
      if (!form.apellidos.trim()) e.apellidos = 'Requerido'
      if (!form.cedula.trim()) e.cedula = 'Requerido'
      if (!form.telefono.trim()) e.telefono = 'Requerido'
    }
    if (s === 3) {
      if (!form.eps.trim()) e.eps = 'Requerido'
      if (!form.fondo_pension.trim()) e.fondo_pension = 'Requerido'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (!validate(step)) return
    setStep(s => (s + 1) as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const prev = () => { setStep(s => (s - 1) as Step); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const handleSubmit = async () => {
    if (!validate(step)) return
    setSending(true)
    try {
      const payload = {
        ...form,
        numero_hijos: form.numero_hijos ? Number(form.numero_hijos) : null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        fecha_ingreso: form.fecha_ingreso || null,
        familiares: familiares.filter(f => f.nombre.trim()).map(f => ({
          nombre: f.nombre,
          relacion: f.relacion,
          fecha_nacimiento: f.fecha_nacimiento || null,
          telefono: f.telefono || null,
        })),
      }
      const res = await publicAPI.registrarTrabajador(payload)
      setCodigoAsignado(res.data.codigo)
      setStep(5)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Error al enviar el formulario. Intenta de nuevo.'
      setErrors({ _global: msg })
    } finally {
      setSending(false)
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  )

  const inputCls = (k: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[k] ? 'border-red-400' : 'border-gray-300'}`

  const steps = ['Datos personales', 'Datos laborales', 'Seguridad social', 'Banco y emergencia', 'Listo']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 text-center">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">TRIPLE A CONSTRUCCIONES SAS</p>
        <h1 className="text-xl font-bold text-gray-900">Inscripción de trabajador</h1>
        <p className="text-sm text-gray-500 mt-0.5">Completa el formulario para registrar tu información</p>
      </div>

      {/* Stepper */}
      {step < 5 && (
        <div className="max-w-2xl mx-auto px-4 pt-6">
          <div className="flex items-center gap-1">
            {steps.slice(0, 4).map((label, i) => {
              const n = i + 1
              const done = step > n
              const active = step === n
              return (
                <div key={n} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {done ? '✓' : n}
                  </div>
                  <span className={`ml-1.5 text-xs hidden sm:block ${active ? 'text-blue-700 font-semibold' : 'text-gray-400'}`}>{label}</span>
                  {n < 4 && <div className={`flex-1 h-0.5 mx-2 ${step > n ? 'bg-blue-600' : 'bg-gray-200'}`} />}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Card */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

          {/* ── Paso 1: Datos personales ─────────────────────────────────── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Datos personales</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombres *" error={errors.nombres}>
                  <input className={inputCls('nombres')} value={form.nombres} onChange={set('nombres')} placeholder="Juan Carlos" />
                </Field>
                <Field label="Apellidos *" error={errors.apellidos}>
                  <input className={inputCls('apellidos')} value={form.apellidos} onChange={set('apellidos')} placeholder="García López" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo de documento">
                  <select className={inputCls('tipo_documento')} value={form.tipo_documento} onChange={set('tipo_documento')}>
                    {TIPOS_DOC.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="Número de documento *" error={errors.cedula}>
                  <input className={inputCls('cedula')} value={form.cedula} onChange={set('cedula')} placeholder="123456789" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Fecha de nacimiento">
                  <input className={inputCls('fecha_nacimiento')} type="date" value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} />
                </Field>
                <Field label="Género">
                  <select className={inputCls('genero')} value={form.genero} onChange={set('genero')}>
                    <option value="">Seleccionar…</option>
                    {GENEROS.map(g => <option key={g}>{g}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Estado civil">
                  <select className={inputCls('estado_civil')} value={form.estado_civil} onChange={set('estado_civil')}>
                    <option value="">Seleccionar…</option>
                    {ESTADOS_CIVILES.map(e => <option key={e}>{e}</option>)}
                  </select>
                </Field>
                <Field label="Nivel educativo">
                  <select className={inputCls('nivel_educativo')} value={form.nivel_educativo} onChange={set('nivel_educativo')}>
                    <option value="">Seleccionar…</option>
                    {NIVELES_EDU.map(n => <option key={n}>{n}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Teléfono *" error={errors.telefono}>
                  <input className={inputCls('telefono')} value={form.telefono} onChange={set('telefono')} placeholder="+57 300 000 0000" />
                </Field>
                <Field label="Email">
                  <input className={inputCls('email')} type="email" value={form.email} onChange={set('email')} placeholder="correo@ejemplo.com" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ciudad">
                  <input className={inputCls('ciudad')} value={form.ciudad} onChange={set('ciudad')} placeholder="Bogotá" />
                </Field>
                <Field label="N.º de hijos">
                  <input className={inputCls('numero_hijos')} type="number" min={0} value={form.numero_hijos} onChange={set('numero_hijos')} placeholder="0" />
                </Field>
              </div>
              <Field label="Dirección">
                <input className={inputCls('direccion')} value={form.direccion} onChange={set('direccion')} placeholder="Calle 1 # 2-3, Apto 4" />
              </Field>
            </div>
          )}

          {/* ── Paso 2: Datos laborales ──────────────────────────────────── */}
          {step === 2 && (
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Datos laborales</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cargo">
                  <input className={inputCls('cargo')} value={form.cargo} onChange={set('cargo')} placeholder="Maestro de obras" />
                </Field>
                <Field label="Especialidad">
                  <input className={inputCls('especialidad')} value={form.especialidad} onChange={set('especialidad')} placeholder="Mampostería" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tipo de vinculación">
                  <select className={inputCls('tipo')} value={form.tipo} onChange={set('tipo')}>
                    {TIPOS_TRAB.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Fecha de ingreso">
                  <input className={inputCls('fecha_ingreso')} type="date" value={form.fecha_ingreso} onChange={set('fecha_ingreso')} />
                </Field>
              </div>
            </div>
          )}

          {/* ── Paso 3: Seguridad social ─────────────────────────────────── */}
          {step === 3 && (
            <div className="p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Seguridad social</h2>
              <div className="grid grid-cols-2 gap-4">
                <Field label="EPS *" error={errors.eps}>
                  <input className={inputCls('eps')} value={form.eps} onChange={set('eps')} placeholder="Sura, Sanitas, Nueva EPS…" />
                </Field>
                <Field label="Fondo de pensión *" error={errors.fondo_pension}>
                  <input className={inputCls('fondo_pension')} value={form.fondo_pension} onChange={set('fondo_pension')} placeholder="Porvenir, Protección, Colpensiones…" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="ARL">
                  <input className={inputCls('arl')} value={form.arl} onChange={set('arl')} placeholder="Sura, Bolívar, Colmena…" />
                </Field>
                <Field label="Caja de compensación">
                  <input className={inputCls('caja_compensacion')} value={form.caja_compensacion} onChange={set('caja_compensacion')} placeholder="Compensar, Cafam, Colsubsidio…" />
                </Field>
              </div>
            </div>
          )}

          {/* ── Paso 4: Banco + emergencia + familiares ──────────────────── */}
          {step === 4 && (
            <div className="p-6 space-y-5">
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-gray-800">Datos bancarios</h2>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Banco">
                    <input className={inputCls('banco')} value={form.banco} onChange={set('banco')} placeholder="Bancolombia" />
                  </Field>
                  <Field label="Tipo de cuenta">
                    <select className={inputCls('tipo_cuenta')} value={form.tipo_cuenta} onChange={set('tipo_cuenta')}>
                      {TIPOS_CUENTA.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Número de cuenta">
                    <input className={inputCls('numero_cuenta')} value={form.numero_cuenta} onChange={set('numero_cuenta')} placeholder="123456789" />
                  </Field>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5 space-y-4">
                <h2 className="text-base font-semibold text-gray-800">Contacto de emergencia</h2>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Nombre">
                    <input className={inputCls('contacto_emergencia_nombre')} value={form.contacto_emergencia_nombre} onChange={set('contacto_emergencia_nombre')} placeholder="Nombre completo" />
                  </Field>
                  <Field label="Teléfono">
                    <input className={inputCls('contacto_emergencia_telefono')} value={form.contacto_emergencia_telefono} onChange={set('contacto_emergencia_telefono')} placeholder="+57 300…" />
                  </Field>
                  <Field label="Relación">
                    <select className={inputCls('contacto_emergencia_relacion')} value={form.contacto_emergencia_relacion} onChange={set('contacto_emergencia_relacion')}>
                      <option value="">Seleccionar…</option>
                      {RELACIONES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-5 space-y-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-semibold text-gray-800">Familiares (opcional)</h2>
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:underline"
                    onClick={() => setFamiliares(f => [...f, emptyFamiliar()])}
                  >
                    + Agregar familiar
                  </button>
                </div>
                {familiares.map((fam, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 items-end border border-gray-100 rounded-lg p-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 mb-0.5 block">Nombre</label>
                      <input className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" value={fam.nombre} onChange={e => setFamiliares(fs => fs.map((x, j) => j === i ? { ...x, nombre: e.target.value } : x))} placeholder="Nombre completo" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">Relación</label>
                      <select className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" value={fam.relacion} onChange={e => setFamiliares(fs => fs.map((x, j) => j === i ? { ...x, relacion: e.target.value } : x))}>
                        <option value="">—</option>
                        {RELACIONES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-1 items-end">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-0.5 block">Teléfono</label>
                        <input className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" value={fam.telefono} onChange={e => setFamiliares(fs => fs.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x))} placeholder="+57…" />
                      </div>
                      <button type="button" className="text-red-400 hover:text-red-600 text-lg pb-0.5" onClick={() => setFamiliares(fs => fs.filter((_, j) => j !== i))}>×</button>
                    </div>
                  </div>
                ))}
                {familiares.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3">Sin familiares agregados</p>
                )}
              </div>
            </div>
          )}

          {/* ── Paso 5: Éxito ────────────────────────────────────────────── */}
          {step === 5 && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-green-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900">¡Registro exitoso!</h2>
              <p className="text-gray-600 text-sm">Tu información ha sido enviada correctamente.</p>
              <div className="inline-block bg-blue-50 border border-blue-200 rounded-xl px-6 py-4">
                <p className="text-xs text-blue-500 uppercase tracking-wide font-semibold mb-1">Tu código de trabajador</p>
                <p className="text-3xl font-bold text-blue-700 font-mono">{codigoAsignado}</p>
              </div>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Guarda este código. El equipo administrativo completará tu vinculación y te notificará.
              </p>
            </div>
          )}

          {/* Error global */}
          {errors._global && (
            <div className="px-6 pb-4">
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{errors._global}</p>
            </div>
          )}

          {/* Navegación */}
          {step < 5 && (
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between">
              {step > 1 ? (
                <button type="button" className="text-sm text-gray-500 hover:text-gray-700 font-medium" onClick={prev}>← Anterior</button>
              ) : <div />}
              {step < 4 ? (
                <button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
                  onClick={next}
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={sending}
                >
                  {sending ? 'Enviando…' : 'Enviar registro ✓'}
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">TRIPLE A CONSTRUCCIONES SAS · Sistema de Gestión Interna</p>
      </div>
    </div>
  )
}
