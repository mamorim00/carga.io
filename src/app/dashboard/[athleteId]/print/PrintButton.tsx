"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper"
    >
      Imprimir / Salvar PDF
    </button>
  );
}
