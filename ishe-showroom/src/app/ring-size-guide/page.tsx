import type { Metadata } from 'next';
import PrintButton from './PrintButton';

export const metadata: Metadata = { title: 'Ring size guide (approximate) · ISHÉ' };

/** Indian ring sizes by inner circumference (about 1 mm per size), with US equivalents. Approximate. */
const ROWS = Array.from({ length: 20 }, (_, i) => {
  const indian = i + 5;
  const circ = 40.8 + (indian - 1);
  const dia = circ / Math.PI;
  const us = (dia - 11.63) / 0.8128;
  return { indian, circ, dia, us: Math.round(us * 4) / 4 };
});

export default function RingSizeGuide() {
  return (
    <main className="min-h-screen bg-paper px-5 py-8 text-ink md:px-12">
      <div className="mx-auto max-w-2xl">
        <p className="plaque-label text-ink/60">ISHÉ · Private showroom</p>
        <h1 className="editorial mt-2 text-[40px] leading-tight">Ring size guide</h1>
        <p className="mt-2 inline-block border border-ink px-2 py-1 font-ui text-[11px] uppercase tracking-[0.2em]">Approximate · for guidance only</p>
        <p className="mt-4 font-ui text-[14px] leading-relaxed text-ink/80">
          Sizes vary between makers and fingers change through the day. Use this chart to find a starting point, and the store will
          confirm the size with you. Adjustable rings in the showroom are marked as such on their panels.
        </p>
        <h2 className="plaque-label mt-8 text-ink/70">Measure a ring you already wear</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 font-ui text-[14px] text-ink/80">
          <li>Place the ring on a ruler and measure the inside diameter, edge to edge, in millimetres.</li>
          <li>Find the closest diameter below. If you are between two sizes, choose the larger.</li>
        </ol>
        <h2 className="plaque-label mt-6 text-ink/70">Or measure your finger</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 font-ui text-[14px] text-ink/80">
          <li>Wrap a strip of paper around the base of the finger, snug but not tight, and mark where it meets.</li>
          <li>Measure the length in millimetres: that is the circumference.</li>
        </ol>
        <div className="mt-6 print:break-inside-avoid">
          <p className="font-ui text-[12px] text-ink/60">Printing check: this bar should measure 50 mm. If it does not, rely on the numbers, not the printout.</p>
          <div className="mt-1 h-2 bg-ink" style={{ width: '50mm' }} aria-label="50 millimetre reference bar" role="img" />
        </div>
        <table className="mt-6 w-full border-collapse font-ui text-[14px]">
          <caption className="sr-only">Approximate ring sizes</caption>
          <thead>
            <tr className="border-b border-ink text-left">
              <th scope="col" className="py-2 pr-4 font-medium">Indian size</th>
              <th scope="col" className="py-2 pr-4 font-medium">Inner diameter (mm)</th>
              <th scope="col" className="py-2 pr-4 font-medium">Circumference (mm)</th>
              <th scope="col" className="py-2 font-medium">US size (approx.)</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.indian} className="border-b border-ink/10">
                <td className="py-1.5 pr-4">{r.indian}</td>
                <td className="py-1.5 pr-4">{r.dia.toFixed(1)}</td>
                <td className="py-1.5 pr-4">{r.circ.toFixed(1)}</td>
                <td className="py-1.5">{r.us < 3 ? '–' : r.us.toFixed(2).replace(/\.00$/, '').replace(/0$/, '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 font-ui text-[12px] text-ink/60">Figures are rounded and approximate. They are not a specification of any ISHÉ piece.</p>
        <div className="mt-6"><PrintButton /></div>
      </div>
    </main>
  );
}
