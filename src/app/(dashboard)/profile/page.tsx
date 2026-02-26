import { getUser } from "@/lib/auth";

export default async function ProfilePage() {
  const { dbUser } = await getUser();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-xl font-bold">Profile</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Name</p>
            <p className="font-medium">{dbUser.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="font-medium">{dbUser.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Role</p>
            <p className="font-medium capitalize">{dbUser.role}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Credit Balance</p>
            <p className="text-lg font-bold">{dbUser.creditBalance} credits</p>
          </div>
        </div>
      </div>
    </div>
  );
}
