// Service: GitHub URL parsing and repo validation

/** Parse owner/repo from a GitHub URL like https://github.com/owner/repo */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/** Check if a public GitHub repo exists (HEAD request, no auth) */
export async function validateRepoExists(owner: string, repo: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      method: "HEAD",
      headers: { "User-Agent": "TaskHive" },
    });
    return res.ok;
  } catch {
    return false;
  }
}
