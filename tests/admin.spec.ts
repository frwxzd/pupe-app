import { DEMO_PASSWORD, expect, loginAs, test } from './helpers'

const json = (origin: string) => ({ origin, 'content-type': 'application/json' })
const buildingsTable = (page: import('@playwright/test').Page) => page.locator('table').first()

test.describe('Super administrador: edificios y encargados', () => {
  test('agrega un edificio nuevo y no permite claves repetidas', async ({ page }) => {
    await loginAs(page, 'super')
    await page.goto('/admin')
    await expect(buildingsTable(page).locator('tbody tr')).toHaveCount(15)

    await page.getByLabel('Clave').fill('ema11')
    await page.getByLabel('Nombre', { exact: true }).fill('Edificio en construcción')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()

    await expect(page.getByText('Edificio EMA11 agregado.')).toBeVisible()
    await expect(buildingsTable(page).locator('tbody tr')).toHaveCount(16)
    await expect(page.getByText('Coordinación de los 16 edificios de CU2.')).toBeVisible()
    // Orden natural: EMA11 queda después de EMA10.
    const codes = await buildingsTable(page).locator('tbody tr td:first-child span:first-child').allTextContents()
    expect(codes.slice(-2)).toEqual(['EMA10', 'EMA11'])

    await page.getByLabel('Clave').fill('EMA11')
    await page.getByRole('button', { name: 'Agregar', exact: true }).click()
    await expect(page.getByText('Ya existe el edificio EMA11.')).toBeVisible()
  })

  test('un encargado solo puede tener un edificio', async ({ page, baseURL }) => {
    await loginAs(page, 'super')
    await page.goto('/admin')
    // Laura (EMA1) no se ofrece para VAL1.
    const val1 = page.getByLabel('Encargado de VAL1')
    await expect(val1.locator('option', { hasText: 'Laura Sánchez' })).toHaveCount(0)

    // Tampoco por la API.
    const res = await page.request.post('/api/acciones/asignarEncargado', {
      headers: json(baseURL!), data: { buildingCode: 'VAL2', managerId: 'u-enc-ema1' },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error).toContain('ya es encargado de EMA1')

    // Al quitarla de EMA1 queda libre y ya se puede asignar a VAL2.
    await page.getByLabel('Encargado de EMA1', { exact: true }).selectOption('')
    await expect(page.getByText('Encargado de EMA1 actualizado.')).toBeVisible()
    await page.getByLabel('Encargado de VAL2').selectOption('u-enc-ema1')
    await expect(page.getByText('Encargado de VAL2 actualizado.')).toBeVisible()
    await expect(page.getByLabel('Encargado de VAL2')).toHaveValue('u-enc-ema1')
  })

  test('elimina la cuenta de un encargado y ya no puede entrar', async ({ page, browser, baseURL }) => {
    // El encargado tiene una sesión abierta que debe cerrarse.
    const other = await browser.newPage({ baseURL })
    await loginAs(other, 'val1')
    expect((await (await other.request.get('/api/estado')).json()).me?.id).toBe('u-enc-val1')

    await loginAs(page, 'super')
    await page.goto('/admin')
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Eliminar cuenta de Jorge Ramírez (Encargado VAL1)' }).click()

    await expect(page.getByText('Cuenta de Jorge Ramírez (Encargado VAL1) eliminada.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Eliminar cuenta de Jorge/ })).toHaveCount(0)
    await expect(page.getByLabel('Encargado de VAL1')).toHaveValue('')

    // Su sesión abierta deja de servir.
    expect((await (await other.request.get('/api/estado')).json()).me).toBeNull()
    await other.close()

    // Y ya no puede iniciar sesión.
    const login = await page.request.post('/api/auth/login', {
      headers: json(baseURL!), data: { email: 'encargado.val1@correo.buap.mx', password: DEMO_PASSWORD },
    })
    expect(login.status()).toBe(401)

    // La bitácora conserva quién lo hizo y a quién.
    await page.goto('/bitacora')
    await expect(page.getByText('Eliminó cuenta de encargado').first()).toBeVisible()
  })
})
