import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './data-table'

interface TestData {
  id: number
  name: string
  email: string
}

const columns: ColumnDef<TestData>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
]

const mockData: TestData[] = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
  { id: 3, name: 'Charlie', email: 'charlie@example.com' },
]

describe('DataTable', () => {
  it('renders data correctly', () => {
    render(<DataTable columns={columns} data={mockData} />)

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('displays column headers', () => {
    render(<DataTable columns={columns} data={mockData} />)

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
  })

  it('shows empty state when data is empty', () => {
    render(<DataTable columns={columns} data={[]} />)

    expect(screen.getByText(/no results/i)).toBeInTheDocument()
  })

  it('supports sorting on columns', async () => {
    const user = userEvent.setup()

    const sortableColumns: ColumnDef<TestData>[] = [
      {
        accessorKey: 'name',
        header: 'Name',
        enableSorting: true,
      },
    ]

    render(<DataTable columns={sortableColumns} data={mockData} />)

    const nameHeader = screen.getByText('Name')

    // Click to sort ascending
    await user.click(nameHeader)

    // Data should be sorted (Alice, Bob, Charlie)
    const cells = screen.getAllByRole('cell')
    const nameCells = cells.filter((cell, index) => index % 2 === 0) // Get first column cells
    expect(nameCells[0]).toHaveTextContent('Alice')
    expect(nameCells[1]).toHaveTextContent('Bob')
    expect(nameCells[2]).toHaveTextContent('Charlie')
  })

  it('displays pagination controls', () => {
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
    }))

    render(<DataTable columns={columns} data={largeData} pageSize={10} />)

    expect(screen.getByText(/previous/i)).toBeInTheDocument()
    expect(screen.getByText(/next/i)).toBeInTheDocument()
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument()
  })

  it('navigates pages correctly', async () => {
    const user = userEvent.setup()

    const largeData = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
    }))

    render(<DataTable columns={columns} data={largeData} pageSize={10} />)

    // Should show first 10 users
    expect(screen.getByText('User 0')).toBeInTheDocument()
    expect(screen.queryByText('User 10')).not.toBeInTheDocument()

    // Click next
    const nextButton = screen.getByText(/next/i)
    await user.click(nextButton)

    // Should show next 10 users
    expect(screen.queryByText('User 0')).not.toBeInTheDocument()
    expect(screen.getByText('User 10')).toBeInTheDocument()
  })

  it('disables Previous button on first page', () => {
    render(<DataTable columns={columns} data={mockData} pageSize={2} />)

    const previousButton = screen.getByText(/previous/i)
    expect(previousButton).toBeDisabled()
  })

  it('disables Next button on last page', async () => {
    const user = userEvent.setup()

    render(<DataTable columns={columns} data={mockData} pageSize={10} />)

    const nextButton = screen.getByText(/next/i)
    expect(nextButton).toBeDisabled()
  })
})
