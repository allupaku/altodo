import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import TagModal from './TagModal';

function renderModal(overrides: Partial<ComponentProps<typeof TagModal>> = {}) {
  const props: ComponentProps<typeof TagModal> = {
    open: true,
    tags: ['alpha'],
    suggestions: ['alpha', 'beta'],
    onClose: vi.fn(),
    onChange: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<TagModal {...props} />) };
}

describe('TagModal', () => {
  it('adds a new tag from the input', () => {
    const onChange = vi.fn();
    renderModal({ onChange });

    const input = screen.getByPlaceholderText('Add tag');
    fireEvent.change(input, { target: { value: 'beta' } });
    fireEvent.click(screen.getByText('Add'));

    expect(onChange).toHaveBeenCalledWith(['alpha', 'beta']);
  });
});
