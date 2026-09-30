import { expect, test } from '@playwright/test'

test('compliance lead captures a verified case archive and inspects it after reload', async ({ page }) => {
  await page.goto('/breach-notification')
  const archive = page.getByRole('region', { name: 'Regulatory case evidence archive' })
  await expect(archive.getByRole('button', { name: 'Capture regulatory case archive' })).toBeDisabled()
  await page.getByLabel('Response control role').selectOption('Compliance Lead')
  await archive.getByRole('button', { name: 'Capture regulatory case archive' }).click()
  await expect(page.getByRole('status')).toContainText('archive captured')
  await expect(archive.getByLabel('Selected regulatory case archive')).toContainText('REG-FCA-204')
  await expect(archive.getByLabel('Selected regulatory case archive')).toContainText('0 pinned authority policy revisions')
  const href = await archive.getByRole('link', { name: 'Download selected case archive' }).getAttribute('href')
  if (!href) throw new Error('Case archive download missing')
  const snapshot = JSON.parse(decodeURIComponent(href.slice(href.indexOf(',') + 1))) as { authorityPolicies: unknown[]; legacyEffectiveScheduleIds: string[] }
  expect(snapshot.authorityPolicies).toEqual([])
  expect(snapshot.legacyEffectiveScheduleIds).toEqual([])
  await page.reload()
  await expect(archive.getByRole('list', { name: 'Regulatory case archive history' })).toContainText('REG-FCA-204')
})
