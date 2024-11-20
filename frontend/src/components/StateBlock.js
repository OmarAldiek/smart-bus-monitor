const StateBlock = ({ title, message, action }) => (
  <div className="rounded-2xl border border-dashed border-secondary/40 bg-white p-10 text-center">
    <h3 className="text-xl font-semibold text-primary mb-2">{title}</h3>
    <p className="text-slate-600 mb-4">{message}</p>
    {action}
  </div>
);

export default StateBlock;
