/**
 * Authoritative polling utility for post-finality state reconciliation.
 * Repeatedly runs a predicate until it returns true or maxRetries is reached.
 */
export async function pollUntilMatch(
  predicate: () => Promise<boolean>,
  maxRetries = 15,
  delayMs = 2000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const matched = await predicate();
      if (matched) return true;
    } catch {
      // Transient error during poll, continue retry loop
    }
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}
