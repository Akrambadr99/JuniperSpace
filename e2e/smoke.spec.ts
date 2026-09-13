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


test('incident closure waits for custody resolution and preserves history on reopen',async({page})=>{
 await page.goto('/operations');const actor=page.getByRole('combobox',{name:'Current actor'});const dialog=page.getByRole('dialog');const panel=page.getByRole('region',{name:'Containment readiness gate'});
 const click=async(name:string)=>page.getByRole('button',{name,exact:true}).click();const save=async()=>{await click('Save command');await expect(dialog).toHaveCount(0);};
 await actor.selectOption('actor-2');await page.getByRole('button',{name:/^Evidence items/}).click();await click('Record evidence analysis');await save();await click('Seal evidence custody');await save();
 await click('Request custody transfer');await dialog.getByLabel('Transfer reason',{exact:true}).fill('Transfer sealed evidence for closure review.'.repeat(70));await save();
 await actor.selectOption('actor-0');await page.getByRole('button',{name:/^Response steps/}).click();await click('Complete response step');await save();
 await panel.getByRole('button',{name:'Run: Declare containment',exact:true}).click();await save();await panel.getByRole('button',{name:'Run: Record service recovery',exact:true}).click();await save();
 await panel.getByRole('button',{name:'Run: Close recovered incident',exact:true}).click();await dialog.getByLabel('Closure rationale',{exact:true}).fill('Endpoint recovered and custody evidence reviewed.');await click('Save command');await expect(dialog.getByRole('alert')).toContainText('pending custody');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/^Custody transfers/}).click();await click('Accept custody transfer');await dialog.getByLabel('Acknowledgement note',{exact:true}).fill('Received sealed evidence with digest verified.');await save();
 await panel.getByRole('button',{name:'Run: Close recovered incident',exact:true}).click();await dialog.getByLabel('Closure rationale',{exact:true}).fill('Endpoint recovered and custody evidence reviewed.');await save();await page.reload();
 await expect(panel).toContainText('close: Endpoint recovered');await panel.getByRole('button',{name:'Run: Reopen incident investigation',exact:true}).click();await dialog.getByLabel('Reopening rationale',{exact:true}).fill('New threat evidence requires further investigation.');await save();await page.reload();
 await expect(panel).toContainText('close: Endpoint recovered');await expect(panel).toContainText('reopen: New threat evidence');
});

test('analyst evidence access requires custodian approval and records consumption',async({page})=>{
 await page.goto('/operations');const actor=page.getByRole('combobox',{name:'Current actor'});const dialog=page.getByRole('dialog');
 const save=async()=>{await dialog.getByRole('button',{name:'Save command',exact:true}).click();await expect(dialog).toHaveCount(0);};
 await actor.selectOption('actor-2');await page.getByRole('button',{name:/^Evidence items/}).click();
 await page.getByRole('button',{name:'Record evidence analysis',exact:true}).click();await save();await page.getByRole('button',{name:'Seal evidence custody',exact:true}).click();await save();
 await actor.selectOption('actor-1');await page.getByRole('button',{name:'Request evidence access',exact:true}).click();
 await dialog.getByLabel('Access expiry',{exact:true}).fill('2026-09-14');await dialog.getByLabel('Access purpose',{exact:true}).fill('Investigate the correlated endpoint beacon.');await save();
 await page.getByRole('button',{name:/^Evidence access grants/}).click();await actor.selectOption('actor-2');
 await page.getByRole('button',{name:'Approve evidence access',exact:true}).click();await save();await actor.selectOption('actor-1');
 await page.getByRole('button',{name:'Open evidence with grant',exact:true}).click();await save();await page.reload();
 await page.getByRole('button',{name:/^Evidence access grants/}).click();await expect(page.locator('.detail-title')).toContainText('consumed');
 await expect(page.locator('.detail')).toContainText('Investigate the correlated endpoint beacon.');
 await page.getByRole('button',{name:/^Evidence items/}).click();await expect(page.locator('.detail-title')).toContainText('sealed');
});


test('integrity mismatch quarantines evidence until a matching observation is independently restored', async ({ page }) => {
    await page.goto('/operations');
    const actor = page.getByRole('combobox', { name: 'Current actor' });const dialog = page.getByRole('dialog');
    const save = async () => { await dialog.getByRole('button', { name: 'Save command', exact: true }).click();await expect(dialog).toHaveCount(0); };
    await actor.selectOption('actor-2');await page.getByRole('button', { name: /^Evidence items/ }).click();
    await page.getByRole('button', { name: 'Record evidence analysis', exact: true }).click();await save();
    await page.getByRole('button', { name: 'Seal evidence custody', exact: true }).click();await save();
    await page.getByRole('button', { name: 'Record integrity observation', exact: true }).click();
    await dialog.getByLabel('Observed digest', { exact: true }).fill('sha256:deadbeef');
    await dialog.getByLabel('Integrity review note', { exact: true }).fill('Acquisition copy checksum differs from the pinned original.');await save();
    await expect(page.locator('.detail-title')).toContainText('quarantined');
    await page.getByRole('button', { name: 'Record integrity observation', exact: true }).click();
    await dialog.getByLabel('Observed digest', { exact: true }).fill('sha256:11223344aabbccdd');
    await dialog.getByLabel('Integrity review note', { exact: true }).fill('Verified original acquisition copy matches the pinned digest.');await save();
    await actor.selectOption('actor-0');await page.getByRole('button', { name: 'Restore verified evidence', exact: true }).click();
    await dialog.getByLabel('Integrity review note', { exact: true }).fill('Commander independently approves release of the verified original.');await save();
    await page.reload();await page.getByRole('button', { name: /^Evidence items/ }).click();
    await expect(page.locator('.detail-title')).toContainText('sealed');
    await page.getByRole('button', { name: /^Integrity observations/ }).click();
    await expect(page.locator('.list .row')).toHaveCount(2);
});
test('assigned remediation requires independent recovery verification',async({page})=>{await page.goto('/response-control');const role=page.getByRole('combobox',{name:'Security role'});await page.getByRole('button',{name:'Plan incident remediation'}).click();await role.selectOption('Security Engineer');await page.getByRole('button',{name:'Execute assigned remediation'}).click();await role.selectOption('Incident Commander');await page.getByRole('button',{name:'Verify incident recovery'}).click();await expect(page.getByRole('status')).toContainText('Remediation verified');await page.reload();await expect(page.getByText('recovered · verified')).toBeVisible();await expect(page.getByRole('region',{name:'Security response history'})).toContainText('remediation-verified')});

test('privileged identity containment closes on fresh zero-session telemetry',async({page})=>{await page.goto('/identity-containment');const role=page.getByLabel('Identity-containment role');await page.getByRole('button',{name:'Open identity containment'}).click();await role.selectOption('Incident Commander');await page.getByRole('button',{name:'Approve identity containment'}).click();await role.selectOption('Security Engineer');await page.getByRole('button',{name:'Execute identity containment'}).click();await page.getByRole('button',{name:'Refresh authentication telemetry'}).click();await role.selectOption('Auditor');await page.getByRole('button',{name:'Verify identity containment'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Containment case'}).locator('xpath=ancestor::section')).toContainText('closed · incident contained');await expect(page.getByRole('heading',{name:'Identity state'}).locator('xpath=ancestor::section')).toContainText('disabled · 0 sessions · credentials v4');await expect(page.getByRole('region',{name:'Identity-containment history'})).toContainText('identity-containment-verified')});

test('detection change stabilizes after validation approval deployment and observation',async({page})=>{await page.goto('/detection-governance');const role=page.getByLabel('Detection-governance role');await page.getByRole('button',{name:'Propose detection change'}).click();await role.selectOption('Auditor');await page.getByRole('button',{name:'Validate detection corpus'}).click();await role.selectOption('Incident Commander');await page.getByRole('button',{name:'Approve detection change'}).click();await role.selectOption('Security Engineer');await page.getByRole('button',{name:'Deploy detection change'}).click();await role.selectOption('Auditor');await page.getByRole('button',{name:'Assess observation window'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Detection change'}).locator('xpath=ancestor::section')).toContainText('stable · rule v4');await expect(page.getByRole('heading',{name:'Active rule'}).locator('xpath=ancestor::section')).toContainText('stable · false positives 3%');await expect(page.getByRole('region',{name:'Detection-governance history'})).toContainText('detection-change-stabilized')});

test('evidence hold releases only after matter closure and independent approval',async({page})=>{await page.goto('/evidence-retention');const role=page.getByLabel('Evidence-retention role');await page.getByRole('button',{name:'Request evidence hold'}).click();await role.selectOption('Incident Commander');await page.getByRole('button',{name:'Approve evidence hold'}).click();await role.selectOption('Security Engineer');await page.getByRole('button',{name:'Apply retention lock'}).click();await role.selectOption('Auditor');await page.getByRole('button',{name:'Close retained matter'}).click();await role.selectOption('Incident Commander');await page.getByRole('button',{name:'Request hold release'}).click();await role.selectOption('Auditor');await page.getByRole('button',{name:'Approve hold release'}).click();await role.selectOption('Security Engineer');await page.getByRole('button',{name:'Release evidence hold'}).click();await page.reload();await expect(page.getByRole('heading',{name:'Legal hold'}).locator('xpath=ancestor::section')).toContainText('released · matter closed');await expect(page.getByRole('heading',{name:'Controlled release'}).locator('xpath=ancestor::section')).toContainText('sealed · retained until 2027-10-01');await expect(page.getByRole('region',{name:'Evidence-retention history'})).toContainText('evidence-hold-released')});
