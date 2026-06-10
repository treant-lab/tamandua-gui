import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableFooter,
} from './table'

describe('Table', () => {
  it('renders with semantic HTML structure', () => {
    const { container } = render(
      <Table>
        <TableCaption>Test Table</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>John Doe</TableCell>
            <TableCell>john@example.com</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total: 1 row</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )

    expect(container.querySelector('table')).toBeInTheDocument()
    expect(container.querySelector('caption')).toBeInTheDocument()
    expect(container.querySelector('thead')).toBeInTheDocument()
    expect(container.querySelector('tbody')).toBeInTheDocument()
    expect(container.querySelector('tfoot')).toBeInTheDocument()
    expect(container.querySelector('th')).toBeInTheDocument()
    expect(container.querySelector('td')).toBeInTheDocument()
  })

  it('renders table data correctly', () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
            <TableCell>30</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Bob</TableCell>
            <TableCell>25</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('applies custom className to table', () => {
    const { container } = render(
      <Table className="custom-table">
        <TableBody>
          <TableRow>
            <TableCell>Data</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(container.querySelector('table')).toHaveClass('custom-table')
  })

  it('supports colSpan on cells', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell colSpan={3}>Spanning cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    const cell = container.querySelector('td')
    expect(cell).toHaveAttribute('colspan', '3')
  })

  it('renders caption with proper styling', () => {
    render(
      <Table>
        <TableCaption>Employee Data</TableCaption>
        <TableBody>
          <TableRow>
            <TableCell>Data</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(screen.getByText('Employee Data')).toBeInTheDocument()
  })

  it('applies custom className to individual components', () => {
    const { container } = render(
      <Table>
        <TableHeader className="custom-header">
          <TableRow className="custom-row">
            <TableHead className="custom-head">Header</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="custom-body">
          <TableRow>
            <TableCell className="custom-cell">Data</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    )

    expect(container.querySelector('thead')).toHaveClass('custom-header')
    expect(container.querySelector('tbody')).toHaveClass('custom-body')
    expect(container.querySelector('th')).toHaveClass('custom-head')
    expect(container.querySelector('td')).toHaveClass('custom-cell')
  })
})
