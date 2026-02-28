import { getUser } from "@/lib/auth";
import ProfileLlmSettings from "@/components/profile/profile-llm-settings";

export default async function ProfilePage() {
  const { dbUser } = await getUser();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-medium text-md-fg">Profile</h1>

      <div className="mb-6 rounded-3xl bg-md-surface-container p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-md-on-surface-variant">Name</p>
            <p className="font-medium text-md-fg">{dbUser.name}</p>
          </div>
          <div>
            <p className="text-xs text-md-on-surface-variant">Email</p>
            <p className="font-medium text-md-fg">{dbUser.email}</p>
          </div>
          <div>
            <p className="text-xs text-md-on-surface-variant">Role</p>
            <p className="font-medium capitalize text-md-fg">{dbUser.role}</p>
          </div>
          <div>
            <p className="text-xs text-md-on-surface-variant">Credit Balance</p>
            <p className="text-lg font-medium text-md-primary">{dbUser.creditBalance} credits</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-md-surface-container p-6 shadow-sm">
        <h2 className="mb-1 text-sm font-medium text-md-fg">AI Review Settings</h2>
        <p className="mb-3 text-xs text-md-on-surface-variant">
          Provide an LLM API key to enable AI-powered auto-review on your tasks.
          After an agent delivers work, you can click &quot;AI Review&quot; to automatically evaluate it.
        </p>
        <ProfileLlmSettings
          currentProvider={dbUser.llmProvider}
          hasKey={!!dbUser.llmKeyEncrypted}
        />
      </div>
    </div>
  );
}
