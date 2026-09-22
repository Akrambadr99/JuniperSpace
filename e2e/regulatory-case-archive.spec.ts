import { expect, test } from '@playwright/test'

test('compliance lead captures a verified case archive and inspects it after reload', async ({ page }) => {
  await page.goto('/breach-notification')
  const archive = page.getByRole('region', { name: 'Regulatory case evidence archive' })
  await expect(archive.getByRole('button', { name: 'Capture regulatory case archive' })).toBeDisabled()
  await page.getByLabel('Response control role').selectOption('Compliance Lead')
  await archive.getByRole('button', { name: 'Capture regulatory case archive' }).click()
  await expect(page.getByRole('status')).toContainText('archive captured')
  await expect(archive.getByLabel('Selected regulatory case archive')).toContainText('REG-FCA-204')
  await page.reload()
  await expect(archive.getByRole('list', { name: 'Regulatory case archive history' })).toContainText('REG-FCA-204')
})
