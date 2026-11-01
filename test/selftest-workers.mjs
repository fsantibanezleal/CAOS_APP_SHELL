// SHG-088: bound concurrent browsers without changing any case, timeout or assertion.
export function selfTestWorkers(value) {
  if (value === undefined) return { plants: 4, legitimate: 3 };
  if (typeof value !== 'string' || !/^[1-4]$/.test(value)) {
    throw new Error('CAOS_GATE_TEST_CONCURRENCY must be an integer from 1 to 4');
  }
  const workers = Number(value);
  return { plants: workers, legitimate: Math.min(3, workers) };
}

export const SELF_TEST_WORKERS = selfTestWorkers(process.env.CAOS_GATE_TEST_CONCURRENCY);
