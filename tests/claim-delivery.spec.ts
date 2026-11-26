import { drawSignature, loginAs, loginStudent, logout, expect, test } from './helpers'

test.describe('Flujo completo de reclamo y entrega', () => {
  test('alumno reclama, encargado aprueba y se genera el acta', async ({ page }) => {
    // 1. Alumno: acepta términos, busca y reclama las llaves.
    await loginStudent(page)
    await page.goto('/objeto/obj-llaves')

    await expect(page.getByRole('heading', { name: 'Llaves con llavero azul' })).toBeVisible()
    await page.getByRole('link', { name: 'Este objeto es mío' }).click()
    await expect(page).toHaveURL(/\/objeto\/obj-llaves\/reclamar$/)

    await page.getByLabel('Marcas distintivas').fill(
      'Tienen un llavero azul con forma de estrella y una llave pequeña dorada.',
    )
    await page.locator('#date').fill('2026-10-30')
    await page
      .getByRole('checkbox', { name: /Declaro ser el propietario/ })
      .check()
    await page.getByRole('button', { name: 'Enviar reclamo' }).click()

    await expect(page).toHaveURL(/\/mis-reclamos$/)
    await expect(page.getByText('Tu reclamo se envió')).toBeVisible()

    // 2. Encargado de VAL1: revisa, aprueba y entrega.
    await logout(page)
    await loginAs(page, 'val1')
    await page.goto('/encargado/reclamos')

    await page.getByRole('link', { name: /Llaves con llavero azul/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Revisar reclamo' })).toBeVisible()

    await page.getByRole('button', { name: 'Aprobar' }).click()
    await expect(page.getByText('Reclamo aprobado. Registra la entrega')).toBeVisible()

    await page.getByRole('link', { name: 'Registrar entrega' }).click()
    await expect(page.getByRole('heading', { name: 'Acta de entrega' })).toBeVisible()

    // La matrícula viene bloqueada con la del alumno que reclamó.
    const matricula = page.locator('#rm')
    await expect(matricula).toHaveValue('202123456')
    await expect(matricula).toHaveAttribute('readonly', '')

    await page.locator('#l4').fill('3456')
    await drawSignature(page)
    await page.getByRole('button', { name: 'Registrar entrega y generar acta' }).click()

    await expect(page).toHaveURL(/\/acta\//)
    await expect(page.getByRole('heading', { name: 'Acta de entrega' })).toBeVisible()
    await expect(page.getByText('Llaves con llavero azul').first()).toBeVisible()

    // 3. El objeto queda devuelto y ya no se puede editar.
    await page.goto('/objeto/obj-llaves')
    await expect(page.getByText('Devuelto', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0)
  })
})
