'use client';
export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="min-h-[44px] border border-ink px-4 font-ui text-[11px] uppercase tracking-[0.2em] hover:bg-ink hover:text-bone print:hidden">
      Print this guide
    </button>
  );
}
