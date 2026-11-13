export default function DashboardLoading() {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-6 sm:px-6">
      <div className="border-b border-edge pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-sm font-semibold text-[#07111f]">
            DA
          </span>
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">
              TTI Rangjung
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">DrukAlert</h1>
          </div>
        </div>
      </div>
      <p className="mt-8 text-sm text-muted">Loading zone status...</p>
    </div>
  );
}
