import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from './label';

describe('Label', () => {
  it('renders with correct typography', () => {
    render(<Label htmlFor="test">Test Label</Label>);
    const label = screen.getByText(/test label/i);
    expect(label).toBeInTheDocument();
    expect(label.tagName).toBe('LABEL');
  });

  it('associates with input via htmlFor', () => {
    render(
      <div>
        <Label htmlFor="email">Email</Label>
        <input id="email" type="email" />
      </div>
    );
    const label = screen.getByText(/email/i);
    expect(label).toHaveAttribute('for', 'email');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Label ref={ref}>Test</Label>);
    expect(ref.current).toBeInstanceOf(HTMLLabelElement);
  });

  it('accepts className for extension', () => {
    render(<Label className="custom-class">Test</Label>);
    const label = screen.getByText(/test/i);
    expect(label.className).toContain('custom-class');
  });
});
