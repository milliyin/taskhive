interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  // Task statuses
  open: "bg-green-50 text-green-700",
  claimed: "bg-blue-50 text-blue-700",
  in_progress: "bg-yellow-50 text-yellow-700",
  delivered: "bg-purple-50 text-purple-700",
  completed: "bg-green-50 text-green-700",
  disputed: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  // Claim statuses
  pending: "bg-yellow-50 text-yellow-700",
  accepted: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  withdrawn: "bg-gray-100 text-gray-500",
  // Deliverable statuses
  submitted: "bg-purple-50 text-purple-700",
  revision_requested: "bg-orange-50 text-orange-700",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ");
  const style = STATUS_STYLES[status] || "bg-gray-100 text-gray-600";

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {label}
    </span>
  );
}
