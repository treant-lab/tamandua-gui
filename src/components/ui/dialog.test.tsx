import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog'

describe('Dialog', () => {
  it('opens when trigger is clicked', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    const trigger = screen.getByText('Open Dialog')
    await user.click(trigger)

    expect(screen.getByText('Dialog Title')).toBeInTheDocument()
  })

  it('renders with controlled open prop', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Controlled Dialog</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByText('Controlled Dialog')).toBeInTheDocument()
  })

  it('closes on Escape key press', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText('Open'))
    expect(screen.getByText('Dialog Title')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    // Dialog should be closed
    expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument()
  })

  it('closes on overlay click', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByText('Open'))
    expect(screen.getByText('Dialog Title')).toBeInTheDocument()

    // Click the overlay (Radix adds data-radix-collection-item to overlay)
    const overlay = document.querySelector('[data-state="open"]')?.previousSibling as HTMLElement
    if (overlay) {
      await user.click(overlay)
    }

    // Dialog should be closed
    expect(screen.queryByText('Dialog Title')).not.toBeInTheDocument()
  })

  it('renders title and description for accessibility', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accessible Title</DialogTitle>
            <DialogDescription>This is a description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByText('Accessible Title')).toBeInTheDocument()
    expect(screen.getByText('This is a description')).toBeInTheDocument()
  })

  it('renders header and footer sections', () => {
    render(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Title</DialogTitle>
          </DialogHeader>
          <div>Content goes here</div>
          <DialogFooter>
            <button>Cancel</button>
            <button>Confirm</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Content goes here')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
  })

  it('applies custom className to content', () => {
    render(
      <Dialog open={true}>
        <DialogContent className="custom-dialog">
          <DialogHeader>
            <DialogTitle>Dialog</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    const dialog = screen.getByText('Dialog').closest('[role="dialog"]')
    expect(dialog).toHaveClass('custom-dialog')
  })

  it('renders in a portal outside the DOM tree', () => {
    const { container } = render(
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Portaled Dialog</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )

    // The dialog content should NOT be inside the container
    const titleInContainer = container.querySelector('[role="dialog"]')
    expect(titleInContainer).toBeNull()

    // But it should exist in the document
    expect(screen.getByText('Portaled Dialog')).toBeInTheDocument()
  })
})
