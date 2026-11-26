import type { APIRequestContext } from '@playwright/test'
import { expect, loginAs, logout, test } from './helpers'

const DAY = 86_400_000
const inDays = (d: number) => new Date(Date.now() + d * DAY).toISOString()
const headers = (origin: string) => ({ origin, 'content-type': 'application/json' })

async function cleanup(request: APIRequestContext, origin: string, now: string) {
  const res = await request.post('/api/test/limpieza', { headers: headers(origin), data: { now } })
  expect(res.ok()).toBe(true)
  return res.json() as Promise<{ objetosDepurados: number; cuentasSuspendidas: number; cuentasEliminadas: number }>
}

/** Registra un alumno nuevo (con código de correo) en su propio contexto. */
async function registerStudent(request: APIRequestContext, origin: string, matricula: string, password: string) {
  const email = `${matricula}@alumno.buap.mx`
  const reg = await request.post('/api/auth/registro', { headers: headers(origin), data: { name: `Alumno ${matricula}`, email, matricula, password } })
  expect(reg.ok()).toBe(true)
  const { code } = await (await request.get(`/api/test/codigo?email=${encodeURIComponent(email)}`)).json()
  const ok = await request.post('/api/auth/verificar', { headers: headers(origin), data: { email, code } })
  expect(ok.ok()).toBe(true)
  return email
}

test.describe('Conservación de datos', () => {
  test('los objetos de más de 6 meses salen del catálogo y pierden fotos y datos personales', async ({ page, baseURL }) => {
    const r = await cleanup(page.request, baseURL!, inDays(200))
    // 8 objetos semilla; la mochila y la calculadora tienen reclamos en curso.
    expect(r.objetosDepurados).toBe(6)

    // El alumno solo ve los dos objetos con reclamo en curso.
    await loginAs(page, 'alumno')
    const student = await (await page.request.get('/api/estado')).json()
    expect(student.db.items.map((i: { id: string }) => i.id).sort()).toEqual(['obj-calculadora', 'obj-mochila'])

    // El super admin conserva una ficha mínima, sin datos personales.
    await logout(page)
    await loginAs(page, 'super')
    const { db } = await (await page.request.get('/api/estado')).json()
    const credencial = db.items.find((i: { id: string }) => i.id === 'obj-credencial')
    expect(credencial.purgedAt).toBeTruthy()
    expect(credencial.status).toBe('archivado')
    expect(credencial.privateData).toBeUndefined()
    expect(credencial.finder.name).toBe('Dato eliminado')
    expect(credencial.finder.signature).toBe('')
    expect(credencial.finder.folio).toMatch(/^PUPE-VAL1-/)
    const botella = db.items.find((i: { id: string }) => i.id === 'obj-botella')
    expect(botella.status).toBe('devuelto')
    expect(botella.photos).toEqual(['/demo/protegido.svg'])
    // El acta de entrega se conserva.
    expect(db.deliveries.some((d: { itemId: string }) => d.itemId === 'obj-botella')).toBe(true)
    // Las pruebas de los reclamos cerrados se borran.
    const rechazado = db.claims.find((c: { id: string }) => c.id === 'rec-audifonos')
    expect(rechazado.evidencePhotos).toEqual([])
    expect(rechazado.evidenceText).toBeUndefined()

    // Una segunda pasada no vuelve a depurar nada.
    expect((await cleanup(page.request, baseURL!, inDays(200))).objetosDepurados).toBe(0)
  })

  test('cuenta inactiva: se suspende, se reactiva por correo y, si no, se elimina', async ({ page, playwright, baseURL }) => {
    const origin = baseURL!
    const ctxA = await playwright.request.newContext({ baseURL })
    const ctxB = await playwright.request.newContext({ baseURL })
    const emailA = await registerStudent(ctxA, origin, '202170001', 'Clave-segura-2026')
    const emailB = await registerStudent(ctxB, origin, '202170002', 'Clave-segura-2026')
    expect((await (await ctxA.get('/api/estado')).json()).me).not.toBeNull()

    // A los 6 meses se suspenden los dos alumnos nuevos (los semilla tienen reclamos en curso).
    const first = await cleanup(page.request, origin, inDays(190))
    expect(first.cuentasSuspendidas).toBe(2)
    expect((await (await ctxA.get('/api/estado')).json()).me).toBeNull()

    // Con la contraseña correcta se le explica cómo reactivarla.
    const blocked = await page.request.post('/api/auth/login', { headers: headers(origin), data: { email: emailA, password: 'Clave-segura-2026' } })
    expect(blocked.status()).toBe(403)
    expect((await blocked.json()).error).toContain('suspendida')
    // Con la contraseña incorrecta no se revela nada.
    const wrong = await page.request.post('/api/auth/login', { headers: headers(origin), data: { email: emailA, password: 'otra-cosa-123' } })
    expect(wrong.status()).toBe(401)

    // A reactiva su cuenta con el código del correo.
    await page.request.post('/api/auth/recuperar', { headers: headers(origin), data: { email: emailA } })
    await expect.poll(async () => (await (await page.request.get(`/api/test/codigo?tipo=recuperar&email=${emailA}`)).json()).code).toMatch(/^\d{6}$/)
    const { code } = await (await page.request.get(`/api/test/codigo?tipo=recuperar&email=${emailA}`)).json()
    const reset = await page.request.post('/api/auth/restablecer', { headers: headers(origin), data: { email: emailA, code, password: 'Clave-nueva-2026' } })
    expect(reset.ok()).toBe(true)
    const back = await ctxA.post('/api/auth/login', { headers: headers(origin), data: { email: emailA, password: 'Clave-nueva-2026' } })
    expect(back.ok()).toBe(true)

    // Un mes después del plazo de gracia: B, que no se reactivó, se elimina.
    // A no se elimina (se reactivó); como esa fecha ya está a más de 6 meses de su
    // último acceso, solo vuelve a suspenderse.
    const second = await cleanup(page.request, origin, inDays(190 + 31))
    expect(second.cuentasEliminadas).toBe(1)
    expect(second.cuentasSuspendidas).toBe(1)
    const gone = await page.request.post('/api/auth/login', { headers: headers(origin), data: { email: emailB, password: 'Clave-segura-2026' } })
    expect(gone.status()).toBe(401)

    await loginAs(page, 'super')
    const { db } = await (await page.request.get('/api/estado')).json()
    const b = db.users.find((u: { matricula: string; deletedAt?: string; name: string }) => u.deletedAt && u.name === 'Alumno')
    expect(b).toBeTruthy()
    expect(b.email).toMatch(/@pupe\.invalid$/)
    expect(b.matricula).toBe('')
    const a = db.users.find((u: { email: string }) => u.email === emailA)
    expect(a.deletedAt).toBeUndefined()
    expect(a.name).toBe('Alumno 202170001')
    await ctxA.dispose()
    await ctxB.dispose()
  })

  test('el panel global muestra la conservación de datos y la limpieza manual; los términos la explican', async ({ page }) => {
    await loginAs(page, 'super')
    await page.goto('/admin')
    await expect(page.getByText('Conservación de datos')).toBeVisible()
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Ejecutar limpieza ahora' }).click()
    await expect(page.getByText(/Limpieza ejecutada: 0 objeto\(s\) depurado\(s\)/)).toBeVisible()

    await page.goto('/terminos')
    await expect(page.getByText(/Conservación de publicaciones: cada objeto se retira del catálogo a los 6 meses/)).toBeVisible()
    await expect(page.getByText(/Cuentas inactivas: la cuenta de alumno que no se use durante 6 meses se suspende/)).toBeVisible()
  })
})
