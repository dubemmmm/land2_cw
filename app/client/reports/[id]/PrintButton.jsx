"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button className="cw-btn cw-btn-navy cw-btn-sm" onClick={() => window.print()} type="button">
      <Printer size={15} />
      <span>Print<span className="client-report-print-more"> or save PDF</span></span>
    </button>
  );
}
