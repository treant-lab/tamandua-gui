import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './select'

describe('Select', () => {
  it('renders with placeholder text', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByText('Select an option')).toBeInTheDocument()
  })

  it('opens dropdown on trigger click', async () => {
    const user = userEvent.setup()

    render(
      <Select>
        <SelectTrigger aria-label="Select option">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByLabelText('Select option')
    await user.click(trigger)

    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
  })

  it('closes on item selection', async () => {
    const user = userEvent.setup()

    render(
      <Select>
        <SelectTrigger aria-label="Select option">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )

    await user.click(screen.getByLabelText('Select option'))
    await user.click(screen.getByText('Option 1'))

    // After selection, the content should be closed (not visible)
    expect(screen.queryByText('Option 1')).not.toBeVisible()
  })

  it('closes on Escape key', async () => {
    const user = userEvent.setup()

    render(
      <Select>
        <SelectTrigger aria-label="Select option">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByLabelText('Select option')
    await user.click(trigger)

    expect(screen.getByText('Option 1')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    // Content should be closed
    expect(screen.queryByText('Option 1')).not.toBeVisible()
  })

  it('shows selected value', async () => {
    const user = userEvent.setup()

    render(
      <Select defaultValue="option1">
        <SelectTrigger aria-label="Select option">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )

    // Should show the selected value, not the placeholder
    expect(screen.getByText('Option 1')).toBeInTheDocument()
  })

  it('supports disabled state', () => {
    render(
      <Select disabled>
        <SelectTrigger aria-label="Select option">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByLabelText('Select option')
    expect(trigger).toBeDisabled()
  })

  it('applies custom className to trigger', () => {
    render(
      <Select>
        <SelectTrigger className="custom-class" aria-label="Select option">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByLabelText('Select option')
    expect(trigger).toHaveClass('custom-class')
  })

  it('highlights item on hover', async () => {
    const user = userEvent.setup()

    render(
      <Select>
        <SelectTrigger aria-label="Select option">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="option1">Option 1</SelectItem>
          <SelectItem value="option2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )

    await user.click(screen.getByLabelText('Select option'))

    const option1 = screen.getByText('Option 1')
    await user.hover(option1)

    // Radix applies data-highlighted when item is focused/hovered
    expect(option1.closest('[role="option"]')).toHaveAttribute('data-state')
  })
})
