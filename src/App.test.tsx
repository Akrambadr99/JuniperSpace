import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('SentinelArc workspace', () => {
  it('opens a domain-specific operational surface', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Suspected credential compromise' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'evidence' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Evidence provenance' })).toBeVisible()
  })
})
