import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import RecurrenceModal from './RecurrenceModal';

function renderModal(overrides: Partial<ComponentProps<typeof RecurrenceModal>> = {}) {
  const props: ComponentProps<typeof RecurrenceModal> = {
    open: true,
    recurrence: 'none',
    endDate: '',
    endCount: '',
    baseDue: '2026-02-10',
    onChange: vi.fn(),
    onClose: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<RecurrenceModal {...props} />) };
}

describe('RecurrenceModal', () => {
  it('shows end controls only when repeat is enabled', () => {
    const { rerender, props } = renderModal();

    expect(screen.queryByText('End date')).not.toBeInTheDocument();
    expect(screen.queryByText('Occurrences')).not.toBeInTheDocument();

    rerender(
      <RecurrenceModal
        {...props}
        recurrence="daily"
      />
    );

    expect(screen.getByText('End date')).toBeInTheDocument();
    expect(screen.getByText('Occurrences')).toBeInTheDocument();
    expect(screen.getByText(/Preview:/)).toBeInTheDocument();
  });

  it('auto-calculates occurrences when end date changes', () => {
    const onChange = vi.fn();
    renderModal({ recurrence: 'daily', onChange });

    const endDateInput = screen.getByLabelText('End date');
    fireEvent.change(endDateInput, { target: { value: '2026-02-12' } });

    expect(onChange).toHaveBeenCalledWith({ endDate: '2026-02-12', endCount: '3' });
  });
});
