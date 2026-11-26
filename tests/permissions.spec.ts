import { loginAs, loginStudent, expect, test } from './helpers'

test.describe('Permisos por rol y edificio', () => {
  test('un alumno no puede entrar al panel de encargado ni al global', async ({ page }) => {
    await loginStudent(page)

    await page.goto('/encargado')
    await expect(page.getByText('Acceso denegado')).toBeVisible()

    await page.goto('/admin')
    await expect(page.getByText('Acceso denegado')).toBeVisible()
  })

  test('un encargado no ve objetos de otro edificio ni el panel global', async ({ page }) => {
    await loginAs(page, 'val1')

    // La mochila pertenece a EMA1; VAL1 no debe poder verla.
    // El servidor ni siquiera envía el objeto de otro edificio al navegador.
    await page.goto('/objeto/obj-mochila')
    await expect(page.getByText('Objeto no encontrado')).toBeVisible()
    await expect(page.getByText('Mochila roja Nike')).toHaveCount(0)

    await page.goto('/admin')
    await expect(page.getByText('Acceso denegado')).toBeVisible()
  })

  test('un encargado solo ve su edificio en el catálogo', async ({ page }) => {
    await loginAs(page, 'val1')
    await page.goto('/catalogo')

    await expect(page.getByText('Como encargado solo ves los objetos de')).toBeVisible()
    await expect(page.getByText('VAL1', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Mochila roja Nike')).toHaveCount(0)
  })
})
