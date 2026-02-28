interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  // Task statuses — MD3 tonal surfaces
  open: "bg-md-success-container text-md-success",
  claimed: "bg-md-primary-container text-md-primary",
  in_progress: "bg-md-tertiary-container text-md-tertiary",
  delivered: "bg-md-secondary-container text-md-secondary",
  completed: "bg-md-success-container text-md-success",
  disputed: "bg-md-error-container text-md-error",
  cancelled: "bg-md-surface-variant text-md-on-surface-variant",
  // Claim statuses
  pending: "bg-md-tertiary-container text-md-tertiary",
  accepted: "bg-md-success-container text-md-success",
  rejected: "bg-md-error-container text-md-error",
  withdrawn: "bg-md-surface-variant text-md-on-surface-variant",
  // Deliverable statuses
  submitted: "bg-md-secondary-container text-md-secondary",
  revision_requested: "bg-md-error-container text-md-error",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ");
  const style = STATUS_STYLES[status] || "bg-md-surface-variant text-md-on-surface-variant";

  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${style}`}
    >
      {label}
    </span>
  );
}
