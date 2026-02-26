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

/**
 * Check if a repo contains web-deployable content (package.json or index.html).
 * Repos without these (e.g. Python CLI, Go binaries) will deploy to Vercel as
 * raw static files, which produces a useless preview.
 */
export async function validateRepoDeployable(
  owner: string,
  repo: string,
  branch?: string
): Promise<{ deployable: boolean; reason?: string }> {
  try {
    const ref = branch || "main";
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/?ref=${ref}`,
      { headers: { "User-Agent": "TaskHive" } }
    );
    if (!res.ok) {
      return { deployable: false, reason: "Could not read repository contents" };
    }
    const files: { name: string }[] = await res.json();
    const names = files.map((f) => f.name);

    if (names.includes("package.json") || names.includes("index.html")) {
      return { deployable: true };
    }

    return {
      deployable: false,
      reason:
        "Repository does not contain package.json or index.html. " +
        "GitHub delivery requires a web-deployable project (e.g. Next.js, React, Vue, static HTML).",
    };
  } catch {
    // If we can't check, allow deployment (fail at Vercel instead of blocking)
    return { deployable: true };
  }
}
