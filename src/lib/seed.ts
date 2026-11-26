import { BUILDING_CODES, PROTECTED_PHOTO } from './constants'
import type { Building, Claim, DB, Delivery, Item, LogEntry, User } from './types'

export const DB_VERSION = 1

function daysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

// Firma de ejemplo dibujada como SVG para los registros semilla.
function demoSignature(name: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><path d="M20 70 C 40 20, 60 20, 70 60 S 100 90, 120 50 S 150 20, 170 60 S 210 80, 230 40 S 260 50, 280 45" fill="none" stroke="#1A1A2E" stroke-width="3" stroke-linecap="round"/><text x="150" y="95" font-family="Arial" font-size="11" fill="#64748b" text-anchor="middle">${name}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export function createSeed(): DB {
  const users: User[] = [
    { id: 'u-alumno1', name: 'Ana López Hernández', email: '202123456@alumno.buap.mx', matricula: '202123456', role: 'student', createdAt: daysAgo(30) },
    { id: 'u-alumno2', name: 'Diego Martínez Ruiz', email: '202123457@alm.buap.mx', matricula: '202123457', role: 'student', createdAt: daysAgo(30) },
    { id: 'u-enc-ema1', name: 'Laura Sánchez (Encargada EMA1)', email: 'encargado.ema1@correo.buap.mx', matricula: '202100001', role: 'manager', buildingCode: 'EMA1', phone: '222 229 5500', createdAt: daysAgo(60) },
    { id: 'u-enc-val1', name: 'Jorge Ramírez (Encargado VAL1)', email: 'encargado.val1@correo.buap.mx', matricula: '202100002', role: 'manager', buildingCode: 'VAL1', createdAt: daysAgo(60) },
    { id: 'u-super', name: 'María Torres (Super administradora)', email: 'super.ema1@correo.buap.mx', matricula: '202000001', role: 'super_admin', buildingCode: 'EMA1', createdAt: daysAgo(90) },
  ]

  const buildings: Building[] = BUILDING_CODES.map((code) => ({
    code,
    type: code.startsWith('VAL') ? 'VAL' : 'EMA',
    managerId: code === 'EMA1' ? 'u-enc-ema1' : code === 'VAL1' ? 'u-enc-val1' : undefined,
  }))

  const counters: Record<string, number> = {}
  const folio = (building: string) => {
    counters[building] = (counters[building] ?? 0) + 1
    return `PUPE-${building}-${String(counters[building]).padStart(4, '0')}`
  }

  const finder = (name: string, matricula: string, building: string, when: string) => ({
    name,
    matricula,
    email: `${matricula}@alumno.buap.mx`,
    phone: '222 000 0000',
    deliveredAt: when,
    signature: demoSignature(name),
    folio: folio(building),
    declarationAccepted: true,
  })

  type ItemSeed = Omit<Item, 'createdAt' | 'updatedAt' | 'complete' | 'sensitive'> & Partial<Pick<Item, 'complete' | 'sensitive'>>
  const mk = (i: ItemSeed): Item => ({
    complete: true,
    sensitive: false,
    ...i,
    createdAt: i.foundAt,
    updatedAt: i.foundAt,
  })

  const items: Item[] = [
    mk({
      id: 'obj-mochila', title: 'Mochila roja Nike', category: 'Mochilas',
      description: 'Mochila roja de tela con un parche al frente y dos compartimentos. Se encontró debajo de una banca.',
      photos: ['/demo/mochila-roja.jpg'], foundAt: daysAgo(6, 12, 30), buildingCode: 'EMA1',
      floorZone: 'Planta baja · pasillo principal', storageLocation: 'Locker 3 de la coordinación EMA1',
      status: 'en_revision', brand: 'Nike', color: 'Rojo', condition: 'Buena, ligeramente sucia',
      components: 'Mochila, cuaderno sin nombre, lapicera', createdBy: 'u-enc-ema1',
      finder: finder('Carlos Pérez Gómez', '202155501', 'EMA1', daysAgo(6, 13)),
    }),
    mk({
      id: 'obj-calculadora', title: 'Calculadora científica', category: 'Electrónicos',
      description: 'Calculadora científica color beige con teclas negras. Funciona.',
      photos: ['/demo/calculadora.jpg'], foundAt: daysAgo(5, 9, 15), buildingCode: 'EMA1',
      floorZone: 'Piso 2 · salón 204', storageLocation: 'Cajón 1 de la coordinación EMA1',
      status: 'en_revision', color: 'Beige', condition: 'Funciona, sin tapa',
      components: 'Calculadora', missing: 'Tapa protectora', complete: false, createdBy: 'u-enc-ema1',
      finder: finder('Sofía Castillo Mora', '202166602', 'EMA1', daysAgo(5, 10)),
    }),
    mk({
      id: 'obj-llaves', title: 'Llaves con llavero azul', category: 'Llaves',
      description: 'Juego de 4 llaves doradas con llavero azul.',
      photos: ['/demo/llaves.jpg'], foundAt: daysAgo(4, 16, 0), buildingCode: 'VAL1',
      floorZone: 'Estacionamiento norte', storageLocation: 'Caja fuerte VAL1',
      status: 'en_resguardo', color: 'Dorado / azul', condition: 'Buena',
      components: '4 llaves y llavero', createdBy: 'u-enc-val1',
      finder: finder('Luis Herrera Díaz', '202177703', 'VAL1', daysAgo(4, 16, 30)),
    }),
    mk({
      id: 'obj-audifonos', title: 'Audífonos negros', category: 'Electrónicos',
      description: 'Audífonos de diadema negros con almohadillas de espuma.',
      photos: ['/demo/audifonos.jpg'], foundAt: daysAgo(8, 11, 0), buildingCode: 'EMA2',
      floorZone: 'Biblioteca · mesa 12', storageLocation: 'Recepción EMA2',
      status: 'en_resguardo', color: 'Negro', condition: 'Buena',
      components: 'Audífonos', createdBy: 'u-super',
      finder: finder('Valeria Núñez Ortiz', '202188804', 'EMA2', daysAgo(8, 12)),
    }),
    mk({
      id: 'obj-credencial', title: 'Credencial BUAP', category: 'Documentos',
      description: 'Credencial de estudiante BUAP. Por seguridad no se publica foto ni nombre; el propietario debe identificarla.',
      photos: [PROTECTED_PHOTO], foundAt: daysAgo(2, 8, 45), buildingCode: 'VAL1',
      floorZone: 'Cafetería', storageLocation: 'Caja fuerte VAL1', status: 'en_resguardo',
      condition: 'Buena', components: 'Credencial', sensitive: true, createdBy: 'u-enc-val1',
      privateData: { sensitiveType: 'identificacion', last4: '4821', legalNotes: 'Credencial a nombre de estudiante de Ingeniería.' },
      finder: finder('Andrea Flores Vega', '202199905', 'VAL1', daysAgo(2, 9)),
    }),
    mk({
      id: 'obj-botella', title: 'Botella de agua', category: 'Termos y botellas',
      description: 'Botella metálica plateada con tapa negra.',
      photos: ['/demo/botella.jpg'], foundAt: daysAgo(12, 14, 0), buildingCode: 'EMA1',
      floorZone: 'Piso 1 · laboratorio de cómputo', storageLocation: 'Locker 1 de la coordinación EMA1',
      status: 'devuelto', color: 'Plateado', condition: 'Buena, con un golpe en la base',
      components: 'Botella y tapa', createdBy: 'u-enc-ema1',
      finder: finder('Ricardo Morales Paz', '202111106', 'EMA1', daysAgo(12, 15)),
    }),
    mk({
      id: 'obj-chamarra', title: 'Chamarra negra', category: 'Ropa',
      description: 'Chamarra negra tipo encerada con botones a presión y cuello alto. Talla M.',
      photos: ['/demo/chamarra.jpg'], foundAt: daysAgo(3, 18, 0), buildingCode: 'VAL3',
      floorZone: 'Auditorio', storageLocation: 'Coordinación VAL3', status: 'en_resguardo',
      color: 'Negro', condition: 'Buena', components: 'Chamarra', createdBy: 'u-super',
      finder: finder('Fernanda Ríos Cruz', '202122207', 'VAL3', daysAgo(3, 18, 20)),
    }),
    mk({
      id: 'obj-celular', title: 'Celular', category: 'Electrónicos',
      description: 'Teléfono inteligente negro con funda transparente. Pantalla bloqueada.',
      photos: ['/demo/celular.jpg'], foundAt: daysAgo(1, 13, 10), buildingCode: 'EMA4',
      floorZone: 'Piso 3 · sanitarios', storageLocation: 'Caja fuerte EMA4', status: 'en_resguardo',
      color: 'Negro', condition: 'Buena, batería al 20%', components: 'Celular y funda',
      sensitive: true, createdBy: 'u-super',
      privateData: { sensitiveType: 'electronico', imei: '356938035643809', serial: 'F2LXK8Q9HG7F' },
      finder: finder('Emilio Vargas León', '202133308', 'EMA4', daysAgo(1, 13, 30)),
    }),
  ]

  const ev = (at: string, by: string, status: Claim['status'], note: string) => ({ at, by, status, note, kind: 'estado' as const })

  const claims: Claim[] = [
    {
      id: 'rec-mochila', itemId: 'obj-mochila', studentId: 'u-alumno1',
      marks: 'Tiene un parche azul con una cruz blanca y mi cuaderno de Cálculo sin nombre.',
      approxDate: dateOnly(daysAgo(6)), serialModel: 'Nike Brasilia', evidenceText: 'Puedo mostrar una foto donde aparezco con la mochila.',
      evidencePhotos: [], declarationAccepted: true, status: 'en_revision', createdAt: daysAgo(5, 9),
      history: [
        ev(daysAgo(5, 9), 'u-alumno1', 'enviado', 'Reclamo enviado.'),
        ev(daysAgo(4, 11), 'u-enc-ema1', 'en_revision', 'El encargado inició la revisión.'),
      ],
    },
    {
      id: 'rec-calculadora', itemId: 'obj-calculadora', studentId: 'u-alumno2',
      marks: 'Tiene mis iniciales DMR grabadas en la parte trasera.',
      approxDate: dateOnly(daysAgo(5)), serialModel: 'Compucorp 324G', evidencePhotos: [],
      declarationAccepted: true, status: 'aprobado', createdAt: daysAgo(4, 10),
      scheduledAt: daysAgo(-1, 12),
      managerNotes: 'Las iniciales coinciden. Entregar en la coordinación EMA1.',
      history: [
        ev(daysAgo(4, 10), 'u-alumno2', 'enviado', 'Reclamo enviado.'),
        ev(daysAgo(3, 9), 'u-enc-ema1', 'en_revision', 'El encargado inició la revisión.'),
        ev(daysAgo(2, 12), 'u-enc-ema1', 'aprobado', 'Las iniciales coinciden. Entregar en la coordinación EMA1.'),
      ],
    },
    {
      id: 'rec-botella', itemId: 'obj-botella', studentId: 'u-alumno2',
      marks: 'Tiene un golpe en la base y una calcomanía rota en la tapa.',
      approxDate: dateOnly(daysAgo(12)), evidencePhotos: [], declarationAccepted: true,
      status: 'entregado', createdAt: daysAgo(11, 9), managerNotes: 'Coincide la descripción del golpe.',
      history: [
        ev(daysAgo(11, 9), 'u-alumno2', 'enviado', 'Reclamo enviado.'),
        ev(daysAgo(10, 10), 'u-enc-ema1', 'en_revision', 'El encargado inició la revisión.'),
        ev(daysAgo(10, 12), 'u-enc-ema1', 'aprobado', 'Coincide la descripción del golpe.'),
        ev(daysAgo(9, 13), 'u-enc-ema1', 'entregado', 'Objeto entregado con acta PUPE-EMA1-0004.'),
      ],
    },
    {
      id: 'rec-audifonos', itemId: 'obj-audifonos', studentId: 'u-alumno1',
      marks: 'Son negros y grandes.', approxDate: dateOnly(daysAgo(9)), evidencePhotos: [],
      declarationAccepted: true, status: 'rechazado', createdAt: daysAgo(7, 9),
      managerNotes: 'La descripción es muy general y la fecha no coincide con el hallazgo.',
      history: [
        ev(daysAgo(7, 9), 'u-alumno1', 'enviado', 'Reclamo enviado.'),
        ev(daysAgo(6, 10), 'u-super', 'en_revision', 'Se inició la revisión.'),
        ev(daysAgo(6, 12), 'u-super', 'rechazado', 'La descripción es muy general y la fecha no coincide con el hallazgo.'),
      ],
    },
  ]

  const deliveries: Delivery[] = [
    {
      id: 'ent-botella', claimId: 'rec-botella', itemId: 'obj-botella',
      receiverName: 'Diego Martínez Ruiz', receiverMatricula: '202123457', idType: 'Credencial BUAP', idLast4: '3457',
      signature: demoSignature('Diego Martínez Ruiz'), condition: 'Buena, con un golpe en la base',
      components: 'Botella y tapa', folio: folio('EMA1'), deliveredAt: daysAgo(9, 13), deliveredBy: 'u-enc-ema1',
      observations: 'Entregada en la coordinación EMA1.',
    },
  ]

  let n = 0
  const log = (at: string, actorId: string, action: string, entity: LogEntry['entity'], entityId: string, buildingCode?: string, after?: string): LogEntry =>
    ({ id: `log-seed-${++n}`, at, actorId, action, entity, entityId, buildingCode, after })

  const logs: LogEntry[] = [
    ...items.map((i) => log(i.createdAt, i.createdBy, 'Publicó objeto', 'objeto', i.id, i.buildingCode, i.title)),
    log(daysAgo(4, 11), 'u-enc-ema1', 'Inició revisión de reclamo', 'reclamo', 'rec-mochila', 'EMA1'),
    log(daysAgo(2, 12), 'u-enc-ema1', 'Aprobó reclamo', 'reclamo', 'rec-calculadora', 'EMA1'),
    log(daysAgo(10, 12), 'u-enc-ema1', 'Aprobó reclamo', 'reclamo', 'rec-botella', 'EMA1'),
    log(daysAgo(9, 13), 'u-enc-ema1', 'Registró entrega', 'entrega', 'ent-botella', 'EMA1', 'PUPE-EMA1-0004'),
    log(daysAgo(6, 12), 'u-super', 'Rechazó reclamo', 'reclamo', 'rec-audifonos', 'EMA2'),
  ].sort((a, b) => b.at.localeCompare(a.at))

  return {
    version: DB_VERSION,
    users,
    buildings,
    items,
    claims,
    deliveries,
    terms: [],
    logs,
    counters,
  }
}
