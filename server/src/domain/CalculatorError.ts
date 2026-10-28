/** An expression the calculator cannot read or compute. The message says how to fix it. */
export class CalculatorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalculatorError';
  }
}
