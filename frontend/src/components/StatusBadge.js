import clsx from "clsx";

const StatusBadge = ({ children, tone = "info" }) => {
  const styles = {
    info: "bg-secondary/10 text-secondary",
    success: "bg-accent/10 text-primary",
    warning: "bg-warning/10 text-warning",
    danger: "bg-red-100 text-red-600",
  };
  return (
    <span className={clsx("px-3 py-1 rounded-full text-xs font-semibold", styles[tone])}>{children}</span>
  );
};

export default StatusBadge;
