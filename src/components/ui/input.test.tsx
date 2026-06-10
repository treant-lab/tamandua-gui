import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './input';

describe('Input', () => {
  it('renders with default styling', () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText(/enter text/i);
    expect(input).toBeInTheDocument();
    expect(input.className).toContain('h-10');
    expect(input.className).toContain('w-full');
    expect(input.className).toContain('rounded-md');
  });

  it('shows error state with red border', () => {
    render(<Input error placeholder="Enter text" />);
    const input = screen.getByPlaceholderText(/enter text/i);
    expect(input.className).toContain('border-error-500');
  });

  it('shows disabled state', () => {
    render(<Input disabled placeholder="Enter text" />);
    const input = screen.getByPlaceholderText(/enter text/i);
    expect(input).toBeDisabled();
    expect(input.className).toContain('disabled:opacity-50');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('accepts all standard input props', () => {
    render(
      <Input
        type="email"
        name="email"
        value="test@example.com"
        onChange={() => {}}
        placeholder="Email"
      />
    );
    const input = screen.getByPlaceholderText(/email/i) as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.name).toBe('email');
    expect(input.value).toBe('test@example.com');
  });
});
