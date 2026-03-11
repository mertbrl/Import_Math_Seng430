import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Step1_ClinicalContext } from './Step1_ClinicalContext';
import { useDomainStore } from '../store/useDomainStore';
import { domains } from '../config/domainConfig';

describe('Step1_ClinicalContext Full Domain Coverage', () => {
  afterEach(() => {
    cleanup();
  });

  domains.forEach((domain) => {
    it(`renders correct textual context for domain: ${domain.domainName}`, () => {
      // Simulate selecting the domain via the global state
      useDomainStore.setState({ selectedDomainId: domain.id });

      render(<Step1_ClinicalContext />);

      expect(screen.getByTestId('step1-domain')).toHaveTextContent(domain.domainName);
      expect(screen.getByTestId('step1-question')).toHaveTextContent(domain.clinicalQuestion);
    });
  });
});
