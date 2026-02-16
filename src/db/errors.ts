export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ('code' in err && (err as { code: string }).code === '23505') return true;
  if ('cause' in err) return isUniqueViolation((err as { cause: unknown }).cause);
  return false;
}
