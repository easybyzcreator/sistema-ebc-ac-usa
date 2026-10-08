// Mask and Commission Calculation Utilities for EBC & Andreia Cakes USA (US Market Compatible)

/**
 * Formats a phone string into standard US format: (XXX) XXX-XXXX or +1 (XXX) XXX-XXXX
 */
export function formatPhoneUS(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");

  // If user typed 11 digits starting with 1 (US country code)
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const mid = digits.slice(4, 7);
    const rest = digits.slice(7, 11);
    return `+1 (${area}) ${mid}-${rest}`;
  }

  // 10 digits or less
  const slice10 = digits.slice(0, 10);
  if (slice10.length === 0) return "";
  if (slice10.length <= 3) return `(${slice10}`;
  if (slice10.length <= 6) return `(${slice10.slice(0, 3)}) ${slice10.slice(3)}`;
  return `(${slice10.slice(0, 3)}) ${slice10.slice(3, 6)}-${slice10.slice(6, 10)}`;
}

// Backward-compatible alias for existing imports
export const formatPhoneBR = formatPhoneUS;

/**
 * Formats a US Zip Code (5 digits or 9 digits: 12345 or 12345-6789)
 */
export function formatZipCodeUS(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 9)}`;
}

/**
 * Formats strictly as Brazilian CPF (000.000.000-00) - maximum 11 digits
 */
export function formatCPF(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export const formatCpfCnpj = formatCPF;

/**
 * Formats a date string into MM/DD/YYYY or DD/MM/YYYY
 */
export function formatDateBRInput(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length >= 5) {
    return digits.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
  } else if (digits.length >= 3) {
    return digits.replace(/(\d{2})(\d{1,2})/, "$1/$2");
  }
  return digits;
}

/**
 * Formats money value to US Dollar currency string (e.g. "1,250.00")
 */
export function formatMoneyUSD(amount?: number): string {
  const rounded = Math.round((amount || 0) * 100) / 100;
  return rounded.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export const BANK_FIXED_FEE = 0.49;
export const BANK_PERCENT_FEE = 0.0349;

/**
 * Calculates bank transaction fee for a received payment:
 * Fixed $0.49 + 3.49% on the received amount
 */
export function calcBankFee(amount: number): number {
  if (!amount || isNaN(amount) || amount <= 0) return 0;
  return Math.round((BANK_FIXED_FEE + (amount * BANK_PERCENT_FEE)) * 100) / 100;
}

/**
 * Calculates the net amount received after bank fee deduction
 */
export function calcNetReceivedAmount(amount: number): number {
  if (!amount || isNaN(amount) || amount <= 0) return 0;
  const fee = BANK_FIXED_FEE + (amount * BANK_PERCENT_FEE);
  return Math.max(0, Math.round((amount - fee) * 100) / 100);
}

/**
 * Calculates 10% commission on a single payment amount AFTER deducting bank fees:
 * Bank fee: $0.49 fixed + 3.49% on the received amount
 * Net base = amount - (0.49 + amount * 3.49%)
 * Commission = 10% of net base
 */
export function calcEgnCommissionSingle(amount: number): number {
  if (!amount || isNaN(amount) || amount <= 0) return 0;
  const netAmount = calcNetReceivedAmount(amount);
  return Math.round(netAmount * 0.10 * 100) / 100;
}

/**
 * Calculates 10% commission for setup fee with installments (supports 1x up to 5x),
 * deducting bank fees on each installment charge
 */
export function calcEgnCommissionSetup(totalSetup: number, installments: number = 1) {
  const count = Math.min(5, Math.max(1, installments || 1));
  if (!totalSetup || isNaN(totalSetup) || totalSetup <= 0) {
    return {
      installments: count,
      installmentAmount: 0,
      bankFeePerInstallment: 0,
      netPerInstallment: 0,
      commissionPerInstallment: 0,
      totalCommission: 0,
    };
  }

  const instAmount = totalSetup / count;
  const bankFee = calcBankFee(instAmount);
  const netInst = calcNetReceivedAmount(instAmount);
  const commPerInst = calcEgnCommissionSingle(instAmount);
  const totalComm = Math.round(commPerInst * count * 100) / 100;

  return {
    installments: count,
    installmentAmount: instAmount,
    bankFeePerInstallment: bankFee,
    netPerInstallment: netInst,
    commissionPerInstallment: commPerInst,
    totalCommission: totalComm,
  };
}
