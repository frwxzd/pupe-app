import { expect, loginAs, loginStudent, test } from './helpers'

const json = (baseURL: string) => ({ origin: baseURL, 'content-type': 'application/json' })

test.describe('Seguridad del login y de la API', () => {
  test('contraseña incorrecta da un error genérico y 5 fallos bloquean la cuenta', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Correo institucional').fill('202123456@alumno.buap.mx')
    for (let i = 1; i <= 5; i++) {
      await page.locator('#password').fill(`incorrecta${i}x`)
      await page.getByRole('button', { name: 'Entrar' }).click()
      const expected = i < 5 ? 'Correo o contraseña incorrectos.' : 'Demasiados intentos fallidos'
      await expect(page.getByText(expected)).toBeVisible()
    }
    // Ni siquiera la contraseña correcta entra mientras dure el bloqueo.
    await page.locator('#password').fill('PupeDemo2026')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Demasiados intentos fallidos')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('un correo inexistente da el mismo mensaje que una contraseña incorrecta', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Correo institucional').fill('202199999@alumno.buap.mx')
    await page.locator('#password').fill('loquesea12345')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible()
  })

  test('la cookie de sesión es HttpOnly y SameSite=Strict', async ({ page, context }) => {
    await loginAs(page, 'alumno')
    const cookies = await context.cookies()
    const sid = cookies.find((c) => c.name.endsWith('pupe_sid'))
    expect(sid).toBeTruthy()
    expect(sid!.httpOnly).toBe(true)
    expect(sid!.sameSite).toBe('Strict')
    // El navegador no puede leerla desde JavaScript.
    expect(await page.evaluate(() => document.cookie)).not.toContain('pupe_sid')
  })

  test('el registro exige una contraseña segura', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('tab', { name: 'Registrarme' }).click()
    await page.getByLabel('Nombre completo').fill('Prueba Segura')
    await page.getByLabel('Correo institucional').fill('202150000@alumno.buap.mx')
    await page.getByLabel('Matrícula').fill('202150000')
    await page.locator('#password').fill('202150000')
    await page.getByRole('button', { name: 'Crear cuenta de alumno' }).click()
    await expect(page.getByText(/al menos 10 caracteres|no puede contener tu matrícula/)).toBeVisible()

    await page.locator('#password').fill('Lapiz-azul-2026')
    await page.getByRole('button', { name: 'Crear cuenta de alumno' }).click()
    await expect(page.getByText('Verifica tu correo')).toBeVisible()
  })

  test('el alumno nunca recibe datos privados ni de otros alumnos', async ({ page }) => {
    await loginStudent(page)
    const state = await (await page.request.get('/api/estado')).json()
    expect(state.me.email).toBe('202123456@alumno.buap.mx')
    const raw = JSON.stringify(state.db)
    expect(raw).not.toContain('356938035643809') // IMEI del celular
    expect(raw).not.toContain('privateData')
    expect(raw).not.toContain('finder')
    expect(raw).not.toContain('202123457') // matrícula de otro alumno
    expect(state.db.logs).toHaveLength(0)
    expect(state.db.claims.every((c: { studentId: string }) => c.studentId === 'u-alumno1')).toBe(true)
  })

  test('la API rechaza peticiones sin sesión, de otro origen o sin permiso', async ({ page, baseURL, playwright }) => {
    const anon = await playwright.request.newContext({ baseURL })
    const noSession = await anon.post('/api/acciones/aprobarReclamo', { headers: json(baseURL!), data: { claimId: 'rec-mochila' } })
    expect(noSession.status()).toBe(401)
    await anon.dispose()

    await loginStudent(page)
    const foreign = await page.request.post('/api/acciones/aceptarTerminos', { headers: json('https://sitio-malicioso.example'), data: {} })
    expect(foreign.status()).toBe(403)

    const forbidden = await page.request.post('/api/acciones/aprobarReclamo', { headers: json(baseURL!), data: { claimId: 'rec-mochila', note: 'yo mismo' } })
    expect(forbidden.status()).toBe(400)
    expect((await forbidden.json()).error).toContain('No tienes permiso')
  })

  test('los campos extra que manda el navegador se ignoran', async ({ page, baseURL }) => {
    await loginAs(page, 'ema1')
    const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const payload = {
        item: {
          title: 'Termo verde', description: 'Termo de prueba', category: 'Termos y botellas', photos: [photo],
          foundAt: new Date(Date.now() - 3600_000).toISOString(), buildingCode: 'EMA1', floorZone: 'Piso 1',
          storageLocation: 'Locker 2', complete: true, sensitive: false,
          status: 'devuelto', createdBy: 'u-super', id: 'obj-inventado',
        },
        finder: {
          name: 'Hallador Prueba', matricula: '202177777', email: '202177777@alumno.buap.mx',
          signature: photo, declarationAccepted: true,
        },
    }
    const res = await page.request.post('/api/acciones/publicarObjeto', { headers: json(baseURL!), data: payload })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    const item = body.db.items.find((i: { id: string }) => i.id === body.result.id)
    expect(item.id).not.toBe('obj-inventado')
    expect(item.status).toBe('en_resguardo')
    expect(item.createdBy).toBe('u-enc-ema1')

    // Un encargado de EMA1 no puede publicar en otro edificio aunque arme la petición a mano.
    const other = await page.request.post('/api/acciones/publicarObjeto', {
      headers: json(baseURL!),
      data: { ...payload, item: { ...payload.item, buildingCode: 'VAL1' } },
    })
    expect(other.status()).toBe(400)
  })

  test('el registro no crea la cuenta hasta escribir el código del correo', async ({ page, baseURL }) => {
    const email = '202160000@alumno.buap.mx'
    await page.goto('/login')
    await page.getByRole('tab', { name: 'Registrarme' }).click()
    await page.getByLabel('Nombre completo').fill('Alumna Verificada')
    await page.getByLabel('Correo institucional').fill(email)
    await page.getByLabel('Matrícula').fill('202160000')
    await page.locator('#password').fill('Cuaderno-verde-77')
    await page.getByRole('button', { name: 'Crear cuenta de alumno' }).click()
    await expect(page.getByText('Verifica tu correo')).toBeVisible()
    await expect(page.getByText(email)).toBeVisible()

    // Sin el código la cuenta todavía no existe.
    const early = await page.request.post('/api/auth/login', {
      headers: { origin: baseURL!, 'content-type': 'application/json' },
      data: { email, password: 'Cuaderno-verde-77' },
    })
    expect(early.status()).toBe(401)

    // Código incorrecto.
    const { code } = await (await page.request.get(`/api/test/codigo?email=${encodeURIComponent(email)}`)).json()
    expect(code).toMatch(/^\d{6}$/)
    const wrong = code === '000000' ? '111111' : '000000'
    await page.getByLabel('Código de verificación').fill(wrong)
    await page.getByRole('button', { name: 'Verificar y crear cuenta' }).click()
    await expect(page.getByText('El código no es correcto. Te quedan 4 intentos.')).toBeVisible()

    // Código correcto: se crea la cuenta y entra.
    await page.getByLabel('Código de verificación').fill(code)
    await page.getByRole('button', { name: 'Verificar y crear cuenta' }).click()
    await page.waitForURL((url) => url.pathname !== '/login')
    const state = await (await page.request.get('/api/estado')).json()
    expect(state.me.email).toBe(email)
  })

  test('5 códigos incorrectos anulan el registro pendiente', async ({ page, baseURL }) => {
    const headers = { origin: baseURL!, 'content-type': 'application/json' }
    const email = '202160001@alumno.buap.mx'
    const reg = await page.request.post('/api/auth/registro', {
      headers, data: { name: 'Intento Malo', email, matricula: '202160001', password: 'Regla-roja-2026' },
    })
    expect(reg.ok()).toBe(true)
    const { code } = await (await page.request.get(`/api/test/codigo?email=${encodeURIComponent(email)}`)).json()
    const wrong = code === '000000' ? '111111' : '000000'
    let last
    for (let i = 0; i < 5; i++) last = await page.request.post('/api/auth/verificar', { headers, data: { email, code: wrong } })
    expect(last!.status()).toBe(429)
    expect((await last!.json()).restart).toBe(true)
    // Ni el código correcto sirve ya.
    const late = await page.request.post('/api/auth/verificar', { headers, data: { email, code } })
    expect(late.ok()).toBe(false)
  })

  test('no se puede pedir otro código antes de un minuto', async ({ page, baseURL }) => {
    const headers = { origin: baseURL!, 'content-type': 'application/json' }
    const email = '202160002@alumno.buap.mx'
    await page.request.post('/api/auth/registro', {
      headers, data: { name: 'Prisa', email, matricula: '202160002', password: 'Goma-blanca-2026' },
    })
    const again = await page.request.post('/api/auth/reenviar', { headers, data: { email } })
    expect(again.status()).toBe(429)
  })

  test('recuperar contraseña por correo cambia la clave y cierra las sesiones abiertas', async ({ page, browser, baseURL }) => {
    const email = '202123456@alumno.buap.mx'
    const headers = { origin: baseURL!, 'content-type': 'application/json' }

    // Una sesión abierta en "otro dispositivo".
    const other = await browser.newContext({ baseURL })
    const otherPage = await other.newPage()
    await loginAs(otherPage, 'alumno')
    expect((await (await otherPage.request.get('/api/estado')).json()).me).not.toBeNull()

    await page.goto('/login')
    await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
    await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible()
    await page.getByLabel('Correo institucional').fill(email)
    await page.getByRole('button', { name: 'Enviar código' }).click()
    await expect(page.getByText('Si el correo tiene una cuenta en PUPE')).toBeVisible()

    await expect.poll(async () => (await (await page.request.get(`/api/test/codigo?tipo=recuperar&email=${email}`)).json()).code).toMatch(/^\d{6}$/)
    const { code } = await (await page.request.get(`/api/test/codigo?tipo=recuperar&email=${email}`)).json()

    await page.getByLabel('Código de verificación').fill(code)
    await page.getByLabel('Nueva contraseña').fill('Nueva-clave-2026')
    await page.getByLabel('Confirmar contraseña').fill('Nueva-clave-2026')
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
    await expect(page.getByText('Tu contraseña se actualizó')).toBeVisible()

    // La sesión del otro dispositivo ya no sirve.
    expect((await (await otherPage.request.get('/api/estado')).json()).me).toBeNull()
    await other.close()

    // La contraseña vieja ya no funciona y la nueva sí.
    const old = await page.request.post('/api/auth/login', { headers, data: { email, password: 'PupeDemo2026' } })
    expect(old.status()).toBe(401)
    await page.locator('#password').fill('Nueva-clave-2026')
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL((url) => url.pathname !== '/login')
  })

  test('recuperar contraseña no revela si el correo existe', async ({ page, baseURL }) => {
    const headers = { origin: baseURL!, 'content-type': 'application/json' }
    const exists = await page.request.post('/api/auth/recuperar', { headers, data: { email: '202123456@alumno.buap.mx' } })
    const missing = await page.request.post('/api/auth/recuperar', { headers, data: { email: '202199999@alumno.buap.mx' } })
    expect(exists.status()).toBe(200)
    expect(missing.status()).toBe(200)
    expect(await exists.json()).toEqual(await missing.json())

    // Un código para un correo sin cuenta da el mismo error genérico.
    const fake = await page.request.post('/api/auth/restablecer', { headers, data: { email: '202199999@alumno.buap.mx', code: '123456', password: 'Otra-clave-2026' } })
    expect(fake.status()).toBe(400)
    expect((await fake.json()).error).toBe('El código no es correcto o ya venció. Pide uno nuevo.')
  })

  test('5 códigos de recuperación incorrectos anulan la solicitud', async ({ page, baseURL }) => {
    const headers = { origin: baseURL!, 'content-type': 'application/json' }
    const email = '202123457@alm.buap.mx'
    await page.request.post('/api/auth/recuperar', { headers, data: { email } })
    await expect.poll(async () => (await (await page.request.get(`/api/test/codigo?tipo=recuperar&email=${email}`)).json()).code).toMatch(/^\d{6}$/)
    const { code } = await (await page.request.get(`/api/test/codigo?tipo=recuperar&email=${email}`)).json()
    const wrong = code === '000000' ? '111111' : '000000'
    let last
    for (let i = 0; i < 5; i++) {
      last = await page.request.post('/api/auth/restablecer', { headers, data: { email, code: wrong, password: 'Otra-clave-2026' } })
    }
    expect(last!.status()).toBe(429)
    const late = await page.request.post('/api/auth/restablecer', { headers, data: { email, code, password: 'Otra-clave-2026' } })
    expect(late.ok()).toBe(false)
  })
})
