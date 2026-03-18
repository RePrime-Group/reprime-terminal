interface CustomTerms {
  lpSplit: number;
  prefReturn: number;
  acqFee: number;
}

export function calculateCustomIRR(baseIRR: number, terms: CustomTerms): number {
  const adjustedIRR =
    baseIRR +
    (terms.lpSplit - 80) * 0.15 -
    (terms.acqFee - 1) * 0.8 +
    (terms.prefReturn - 8) * -0.3;

  return Math.max(0, Math.round(adjustedIRR * 100) / 100);
}
