import { expect, loginAs, loginStudent, logout, test } from './helpers'

const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const monthOf = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

test.describe('Bitácora y reporte mensual', () => {
  test('la bitácora guarda los accesos del personal pero no los de los alumnos', async ({ page }) => {
    await loginStudent(page)
    await logout(page)
    await loginAs(page, 'ema1')
    await logout(page)
    await loginAs(page, 'super')

    const { db } = await (await page.request.get('/api/estado')).json()
    const logins = db.logs.filter((l: { action: string }) => l.action === 'Inició sesión').map((l: { actorId: string }) => l.actorId)
    expect(logins).toContain('u-enc-ema1')
    expect(logins).toContain('u-super')
    expect(logins).not.toContain('u-alumno1')
    // Tampoco quedan otros movimientos de cuenta de alumnos.
    expect(db.logs.some((l: { entity: string; entityId: string }) => l.entity === 'usuario' && l.entityId.startsWith('u-alumno'))).toBe(false)
    // Los procesos sí: el reclamo enviado por la alumna en la semilla y las decisiones.
    expect(db.logs.some((l: { action: string }) => l.action === 'Aprobó reclamo')).toBe(true)
  })

  test('el reporte del mes reúne objetos con foto, reclamos, entregas y bitácora', async ({ page }) => {
    await loginAs(page, 'super')
    const { db } = await (await page.request.get('/api/estado')).json()
    const month = thisMonth()
    const received = db.items.filter((i: { createdAt: string }) => monthOf(i.createdAt) === month).length

    await page.goto('/reportes')
    await expect(page.getByRole('heading', { name: 'Reporte mensual' })).toBeVisible()
    await expect(page.getByRole('heading', { name: `2. Objetos recibidos (${received})` })).toBeVisible()
    await expect(page.locator('.report-item img').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: /Registro completo de la bitácora/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Accesos del personal/ })).toBeVisible()

    // Un mes sin movimientos.
    await page.getByLabel('Mes').fill('2025-01')
    await expect(page.getByText('No se recibieron objetos este mes.')).toBeVisible()

    // El encargado solo ve su edificio y no ve los accesos del personal.
    await logout(page)
    await loginAs(page, 'ema1')
    await page.goto('/reportes')
    await expect(page.getByText('Edificio EMA1 · Generado')).toBeVisible()
    await expect(page.getByRole('heading', { name: /Accesos del personal/ })).toHaveCount(0)
    const others = await page.locator('.report-item p.text-xs', { hasText: /· (VAL|EMA[2-9])/ }).count()
    expect(others).toBe(0)
  })
})
