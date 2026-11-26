import { acceptTermsIfNeeded, loginAs, expect, test } from './helpers'

test.describe('Términos y condiciones', () => {
  test('bloquean el catálogo hasta que el alumno los acepta', async ({ page }) => {
    await loginAs(page, 'alumno')

    // Al entrar, el alumno cae en términos.
    await expect(page).toHaveURL(/\/terminos$/)
    await expect(page.getByRole('heading', { name: 'Términos y condiciones', exact: true })).toBeVisible()

    // Aunque escriba /catalogo, sigue bloqueado.
    await page.goto('/catalogo')
    await expect(page).toHaveURL(/\/terminos$/)

    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Aceptar y continuar' }).click()

    // Después de aceptar, se le permite el catálogo.
    await expect(page).toHaveURL(/\/catalogo$/)
    await expect(page.getByRole('heading', { name: 'Buscar objetos' })).toBeVisible()
  })

  test('el encargado no necesita aceptar términos para entrar al panel', async ({ page }) => {
    await loginAs(page, 'ema1')
    await acceptTermsIfNeeded(page)
    await page.goto('/encargado')

    await expect(page.getByRole('heading', { name: /Mi edificio|Panel de edificio/ })).toBeVisible()
    await expect(page.getByText('Acceso denegado')).toHaveCount(0)
  })
})
