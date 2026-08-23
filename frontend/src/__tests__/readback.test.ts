import { describe, expect, it, vi } from 'vitest';
import { pollUntilMatch } from '../utils/readback';

describe('authoritative readback polling', () => {
  it('retries stale reads until the expected state is observable', async () => {
    const predicate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await expect(pollUntilMatch(predicate, 3, 0)).resolves.toBe(true);
    expect(predicate).toHaveBeenCalledTimes(3);
  });

  it('fails closed when the expected state never becomes observable', async () => {
    const predicate = vi.fn().mockResolvedValue(false);
    await expect(pollUntilMatch(predicate, 3, 0)).resolves.toBe(false);
    expect(predicate).toHaveBeenCalledTimes(3);
  });

  it('retries transient read failures but remains bounded', async () => {
    const predicate = vi.fn().mockRejectedValueOnce(new Error('temporary RPC failure')).mockResolvedValueOnce(true);
    await expect(pollUntilMatch(predicate, 2, 0)).resolves.toBe(true);
    expect(predicate).toHaveBeenCalledTimes(2);
  });
});
