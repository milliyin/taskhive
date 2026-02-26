// Service: Vercel Deployments API — deploy from GitHub via gitSource

const VERCEL_API = "https://api.vercel.com";
const PROJECT_NAME = "taskhive-previews";

function getToken(): string {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN environment variable is required");
  return token;
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

export interface DeploymentResult {
  id: string;
  url: string;
  readyState: string;
}

// Cache: only disable protection once per process lifetime
let protectionDisabled = false;

/** Ensure the preview project has deployment protection turned off so anyone can view previews */
async function ensurePublicPreviews(): Promise<void> {
  if (protectionDisabled) return;
  try {
    // Find project by name
    const res = await fetch(`${VERCEL_API}/v9/projects/${PROJECT_NAME}`, {
      headers: headers(),
    });
    if (!res.ok) return;
    const project = await res.json();

    // Disable SSO Protection + Password Protection on all deployments
    const patchRes = await fetch(`${VERCEL_API}/v9/projects/${project.id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({
        ssoProtection: null,
        passwordProtection: null,
      }),
    });
    if (patchRes.ok) protectionDisabled = true;
  } catch {
    // Best-effort — don't block deployment if this fails
  }
}

/** Create a deployment from a public GitHub repo using Vercel's gitSource */
export async function createGitDeployment(
  owner: string,
  repo: string,
  ref: string,
  envVars?: Record<string, string>
): Promise<DeploymentResult> {
  // Ensure previews are publicly accessible
  await ensurePublicPreviews();

  const body: Record<string, unknown> = {
    name: PROJECT_NAME,
    gitSource: {
      type: "github",
      org: owner,
      repo,
      ref: ref || "main",
    },
    projectSettings: {
      framework: null, // auto-detect
    },
  };

  if (envVars && Object.keys(envVars).length > 0) {
    body.env = envVars;
  }

  const res = await fetch(`${VERCEL_API}/v13/deployments`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || err.message || `Vercel API error: ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  return {
    id: data.id,
    url: data.url ? `https://${data.url}` : "",
    readyState: data.readyState || "QUEUED",
  };
}

/** Delete a deployment (best-effort, does not throw on failure) */
export async function deleteDeployment(deploymentId: string): Promise<void> {
  try {
    await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}`, {
      method: "DELETE",
      headers: headers(),
    });
  } catch {
    // Best-effort — don't block callers if deletion fails
  }
}

/** Check deployment status */
export async function getDeploymentStatus(deploymentId: string): Promise<DeploymentResult> {
  const res = await fetch(`${VERCEL_API}/v13/deployments/${deploymentId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Failed to check deployment status: ${res.status}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    url: data.url ? `https://${data.url}` : "",
    readyState: data.readyState || "UNKNOWN",
  };
}
