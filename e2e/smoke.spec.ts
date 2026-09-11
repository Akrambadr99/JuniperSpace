import { expect, test } from '@playwright/test'

test('SentinelArc exposes its primary domain workflow', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('SentinelArc')
  await expect(page.getByRole('heading', { level: 1, name: 'Suspected credential compromise' })).toBeVisible()
  await page.getByRole('button', { name: 'evidence' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Evidence provenance' })).toBeVisible()
})
