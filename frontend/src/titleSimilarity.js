/**
 * Compute title similarity ratio (0–1) using longest common subsequence.
 * Mirrors Python's difflib.SequenceMatcher ratio: 2 * LCS / (len(a) + len(b)).
 * Normalizes both strings to lowercase + trimmed before comparison.
 */
export default function titleSimilarity(a, b) {
  const s1 = (a || '').trim().toLowerCase();
  const s2 = (b || '').trim().toLowerCase();

  if (s1 === s2) return 1;
  if (!s1.length || !s2.length) return 0;

  const m = s1.length;
  const n = s2.length;

  // DP table for longest common subsequence
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return (2 * dp[m][n]) / (m + n);
}
