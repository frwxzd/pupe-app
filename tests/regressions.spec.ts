import { loginAs, expect, test } from './helpers'

test.describe('Regresiones de la revisión', () => {
  test('el acta bloquea la matrícula del alumno que reclamó', async ({ page }) => {
    await loginAs(page, 'ema1')
    await page.goto('/encargado/entrega/rec-calculadora')

    await expect(page.getByRole('heading', { name: 'Acta de entrega' })).toBeVisible()
    const matricula = page.locator('#rm')
    await expect(matricula).toHaveValue('202123457')
    await expect(matricula).toHaveAttribute('readonly', '')
    await expect(page.getByText('Debe coincidir con el alumno que reclamó.')).toBeVisible()
  })

  test('un objeto devuelto no muestra el botón de editar', async ({ page }) => {
    await loginAs(page, 'ema1')
    await page.goto('/objeto/obj-botella')

    await expect(page.getByText('Devuelto', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Acta de entrega' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0)
  })

  test('un reclamo rechazado no muestra acciones de decisión', async ({ page }) => {
    await loginAs(page, 'super')
    await page.goto('/encargado/reclamos/rec-audifonos')

    await expect(page.getByText('Rechazado').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aprobar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Rechazar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Pedir más información' })).toHaveCount(0)
  })

  test('el super admin ve los 15 edificios', async ({ page }) => {
    await loginAs(page, 'super')
    await page.goto('/admin')

    await expect(page.getByRole('heading', { name: 'Panel global' })).toBeVisible()
    await expect(page.getByText('Coordinación de los 15 edificios de CU2.')).toBeVisible()
    await expect(page.locator('table').first().locator('tbody tr')).toHaveCount(15)
    await expect(page.getByText('EMA10').first()).toBeVisible()
  })
})
