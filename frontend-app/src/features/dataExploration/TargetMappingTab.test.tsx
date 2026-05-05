import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import TargetMappingTab from './TargetMappingTab';
import { useDomainStore } from '../../store/useDomainStore';
import { useEDAStore } from '../../store/useEDAStore';

describe('TargetMappingTab', () => {
  beforeEach(() => {
    useDomainStore.setState({ schemaValid: false, currentStep: 2 });
    useEDAStore.setState({
      mlTask: 'classification',
      targetColumn: '',
      totalRows: 0,
      ignoredColumns: ['patient_id'],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows columns that were skipped from analysis in the target dropdown', () => {
    render(
      <TargetMappingTab
        columns={[
          {
            name: 'age',
            type: 'Numeric',
            distinct: 8,
            missing: 0,
            missingPct: 0,
            distribution: [],
          },
        ]}
        totalRows={12}
        allColumnNames={['patient_id', 'age']}
        previewRows={[
          { patient_id: 'P-1', age: 51 },
          { patient_id: 'P-2', age: 63 },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText('Target Column'), {
      target: { value: 'patient_id' },
    });

    expect(
      screen.getByRole('option', { name: /patient_id \(Categorical, analysis skipped\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/hidden from eda analysis/i)).toBeInTheDocument();
  });
});
