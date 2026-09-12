import{expect,test}from'@playwright/test';test('SentinelArc exposes routed enterprise workflows',async({page})=>{await page.goto('/');await expect(page.getByRole('heading',{name:'SentinelArc command center'})).toBeVisible();await page.getByRole('link',{name:'Operations'}).click();const plan=page.getByRole('region',{name:'Incident correlation plan'});await plan.getByRole('textbox',{name:'Filter alerts'}).fill('no-alert');await expect(plan).toContainText('0 ready to correlate');await page.getByRole('link',{name:'Workflows'}).click();await expect(page.getByRole('heading',{name:'Workflow catalog'})).toBeVisible();await page.getByRole('link',{name:'Data model'}).click();await expect(page.getByRole('heading',{name:'Connected data model'})).toBeVisible();await page.getByRole('link',{name:'Data tools'}).click();await expect(page.getByRole('heading',{name:'Import and recovery tools'})).toBeVisible();await page.getByRole('textbox',{name:'Workspace JSON'}).fill('{}');await page.getByRole('button',{name:'Preview import'}).click();await expect(page.getByRole('alert')).toContainText('not a compatible');await page.getByRole('link',{name:'Activity',exact:true}).click();await expect(page.getByRole('heading',{name:'Operational activity'})).toBeVisible()})

test('recipient acceptance persists custody and acknowledgement history', async ({ page }) => {
    await page.goto('/operations');
    const actor = page.getByRole('combobox', { name: 'Current actor' });
    const action = async (name: string) => page.getByRole('button', { name, exact: true }).click();
    const save = async () => { await action('Save command'); await expect(page.getByRole('dialog')).toHaveCount(0); };
    await actor.selectOption('actor-2'); await page.getByRole('button', { name: /^Evidence items/ }).click();
    await action('Record evidence analysis'); await save(); await action('Seal evidence custody'); await save();
    await action('Request custody transfer');
    await page.getByRole('dialog').getByRole('textbox', { name: 'Transfer reason', exact: true }).fill('Transfer sealed evidence for incident review.'); await save();
    await page.getByRole('button', { name: /^Custody transfers/ }).click(); await action('Accept custody transfer');
    await page.getByRole('dialog').getByRole('textbox', { name: 'Acknowledgement note', exact: true }).fill('Received sealed evidence with matching digest.');
    await action('Save command'); await expect(page.getByRole('alert')).toContainText('named recipient'); await page.keyboard.press('Escape');
    await actor.selectOption('actor-0'); await action('Accept custody transfer');
    await page.getByRole('dialog').getByRole('textbox', { name: 'Acknowledgement note', exact: true }).fill('Received sealed evidence with matching digest.'); await save();
    await page.reload(); await page.getByRole('button', { name: /^Evidence items/ }).click();
    await expect(page.locator('.detail')).toContainText('Current custodianactor-0');
    await expect(page.locator('.detail')).toContainText('sha256:11223344aabbccdd');
    await page.getByRole('button', { name: /^Custody acknowledgements/ }).click();
    await expect(page.locator('.detail')).toContainText('Received sealed evidence with matching digest.');
    await expect(page.locator('.detail-title')).toContainText('recorded');
});
