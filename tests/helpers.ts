import { test as base, expect, type Page } from '@playwright/test'

export { expect }

/** Igual que `test` de Playwright, pero cada prueba empieza con los datos semilla. */
export const test = base.extend<{ freshData: void }>({
  freshData: [async ({ request, baseURL }, use) => {
    const res = await request.post('/api/test/reset', { headers: { origin: baseURL!, 'content-type': 'application/json' }, data: {} })
    expect(res.ok(), 'No se pudo restablecer la base de pruebas').toBeTruthy()
    await use()
  }, { auto: true }],
})

type DemoRole = 'alumno' | 'alumno2' | 'ema1' | 'val1' | 'super'

const DEMO_EMAIL: Record<DemoRole, string> = {
  alumno: '202123456@alumno.buap.mx',
  alumno2: '202123457@alm.buap.mx',
  ema1: 'encargado.ema1@correo.buap.mx',
  val1: 'encargado.val1@correo.buap.mx',
  super: 'super.ema1@correo.buap.mx',
}

/** Contraseña de las cuentas semilla en el servidor de pruebas (DEMO_MODE=true, sin DEMO_PASSWORD). */
export const DEMO_PASSWORD = 'PupeDemo2026'

/** Inicia sesión con una cuenta semilla escribiendo correo y contraseña. */
export async function loginAs(page: Page, role: DemoRole) {
  await page.goto('/login')
  await page.getByLabel('Correo institucional').fill(DEMO_EMAIL[role])
  await page.locator('#password').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL((url) => url.pathname !== '/login')
  // El Guard puede tardar un instante en redirigir a /terminos.
  await page.waitForTimeout(300)
}

/** Acepta los términos si la app redirigió a esa pantalla. */
export async function acceptTermsIfNeeded(page: Page) {
  if (!page.url().includes('/terminos')) return
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Aceptar y continuar' }).click()
  await page.waitForURL((url) => url.pathname !== '/terminos')
}

/** Alumno con términos aceptados, listo para usar el catálogo. */
export async function loginStudent(page: Page) {
  await loginAs(page, 'alumno')
  await acceptTermsIfNeeded(page)
  await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()
}

export async function logout(page: Page) {
  await page.goto('/perfil')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL(/\/login$/)
}

/** Dibuja una firma simple en el primer canvas visible. */
export async function drawSignature(page: Page) {
  const canvas = page.locator('canvas').first()
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  if (!box) throw new Error('No se encontró el canvas de firma.')

  const startX = box.x + box.width * 0.12
  const startY = box.y + box.height * 0.62
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) {
    const x = box.x + box.width * (0.12 + i * 0.07)
    const y = box.y + box.height * (i % 2 === 0 ? 0.35 : 0.72)
    await page.mouse.move(x, y)
  }
  await page.mouse.up()
  await page.waitForTimeout(120)
}
