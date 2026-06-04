import React from "react";
import { Info } from "lucide-react";

export function FinancialDisclaimer() {
  return (
    <div className="max-w-5xl mx-auto mt-12 bg-zinc-950/60 p-6 sm:p-8 rounded-3xl border border-white/5 space-y-6 text-left">
      <div className="flex items-start gap-3.5">
        <Info className="w-5 h-5 text-amber-500/80 shrink-0 mt-1" />
        <div className="space-y-1 border-b border-white/5 pb-3 w-full">
          <h4 className="text-xs uppercase tracking-[0.15em] font-black text-white">
            Financial & Religious Disclaimer
          </h4>
          <span className="text-[9px] text-zinc-500 font-mono block">
            Updated Daily • Informational & Educational Purposes Only
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-[11px] sm:text-xs text-zinc-400 leading-relaxed font-sans">
        <div className="space-y-3">
          <p>
            The Iman Calculator and related savings tools are designed to support the Muslim Ummah with personal organization, worship planning, and Islamic financial awareness.
          </p>
          <p className="font-bold text-zinc-300">
            We are NOT a bank, investment company, financial institution, licensed financial advisor, tax advisor, or legal service provider.
          </p>
          <p>
            All calculations, savings trackers, currency conversions, zakat estimates, and Hajj planning tools are provided for informational and educational purposes only. While we aim to provide accurate and helpful tools, we do not guarantee financial accuracy, religious rulings, investment outcomes, or legal compliance in your specific country or situation.
          </p>
          <p>
            Any savings goals, projections, or estimates shown within the platform should not be considered professional financial advice or guarantees.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
              Recommended Actions:
            </span>
            <ul className="list-disc pl-4 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-300">Scholarly Council:</strong> Consult qualified Islamic scholars for religious guidance
              </li>
              <li>
                <strong className="text-zinc-300">Professional Advice:</strong> Consult licensed financial professionals for financial advice
              </li>
              <li>
                <strong className="text-zinc-300">Legal Compliance:</strong> Consult legal or tax professionals regarding compliance and obligations
              </li>
            </ul>
          </div>

          <p>
            Your financial decisions remain your sole responsibility.
          </p>
          
          <p className="text-[11px] text-zinc-500 leading-normal border-t border-white/5 pt-3">
            Our mission is simply to support Muslims worldwide with tools that encourage preparation, discipline, charity, worship, and beneficial financial habits in accordance with Islamic values.
          </p>
        </div>
      </div>
    </div>
  );
}
