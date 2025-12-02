const variantClasses = {
  default: "bg-card",
  accent: "bg-accent/10 text-primary",
  warning: "bg-warning/10 text-warning",
};

const MetricCard = ({ label, value, subtext, variant = "default" }) => {
  return (
    <div className={`rounded-2xl p-5 shadow-card border border-slate-100 ${variantClasses[variant] || variantClasses.default}`}>
      <p className="text-sm uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-3xl font-semibold text-primary mt-2">{value}</p>
      {subtext && <p className="text-sm text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
};

export default MetricCard;
