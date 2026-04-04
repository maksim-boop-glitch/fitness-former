/**
 * Calculates a 0-100 form score from rule evaluation results.
 * Errors deduct twice as much as warnings.
 *
 * @param {Array<{pass: boolean, severity: 'error'|'warning'}>} results
 * @returns {number} integer 0-100
 */
export function calculateScore(results) {
  if (results.length === 0) return 100;

  const deductionPerError = 50;
  const deductionPerWarning = 25;

  let totalDeduction = 0;
  for (const result of results) {
    if (!result.pass) {
      totalDeduction += result.severity === 'error' ? deductionPerError : deductionPerWarning;
    }
  }

  return Math.max(0, 100 - totalDeduction);
}
