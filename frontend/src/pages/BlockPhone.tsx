import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";

export default function BlockPhone() {
  const navigate = useNavigate();
  const [checkedItems, setCheckedItems] = useState({
    fir: false,
    sim: false,
    invoice: false,
  });

  const allReady = checkedItems.fir && checkedItems.sim && checkedItems.invoice;

  const toggleCheck = (key: keyof typeof checkedItems) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Layout>
      {/* ── Header ── */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-surface text-muted transition hover:bg-canvas"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-ink">Block Lost Phone</h1>
          <p className="text-xs font-semibold text-navy">Via Gov. of India CEIR Portal</p>
        </div>
      </div>

      {/* ── Info Card ── */}
      <div className="mb-6 rounded-card border border-navy/20 bg-gradient-to-br from-navy/5 to-transparent px-4 py-4">
        <div className="mb-2 flex items-center gap-2">
          <svg className="h-5 w-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-sm font-bold text-navy">What is CEIR?</h2>
        </div>
        <p className="text-xs leading-relaxed text-ink/80">
          The Central Equipment Identity Register (CEIR) is an initiative by the Dept. of Telecommunications.
          Blocking your phone's IMEI here makes it completely useless on <strong>all mobile networks in India</strong>, rendering it worthless to thieves.
        </p>
      </div>

      {/* ── Prerequisites Checklist ── */}
      <div className="mb-6">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">Mandatory Prerequisites</h3>
        <p className="mb-4 text-xs text-ink/70">Before you can submit a block request on the official portal, you must have the following ready:</p>

        <div className="space-y-3">
          <label className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 transition ${checkedItems.fir ? "border-safe bg-safe-bg" : "border-hairline bg-surface hover:bg-canvas"}`}>
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checkedItems.fir ? "border-safe bg-safe text-white" : "border-muted bg-white"}`}>
              {checkedItems.fir && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Police Complaint (FIR)</p>
              <p className="text-xs text-muted">A digital or physical copy of the police complaint report and the complaint number.</p>
            </div>
            <input type="checkbox" className="hidden" checked={checkedItems.fir} onChange={() => toggleCheck("fir")} />
          </label>

          <label className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 transition ${checkedItems.sim ? "border-safe bg-safe-bg" : "border-hairline bg-surface hover:bg-canvas"}`}>
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checkedItems.sim ? "border-safe bg-safe text-white" : "border-muted bg-white"}`}>
              {checkedItems.sim && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Duplicate SIM Card</p>
              <p className="text-xs text-muted">You must block the lost SIM and obtain a duplicate from your telecom operator to receive the OTP.</p>
            </div>
            <input type="checkbox" className="hidden" checked={checkedItems.sim} onChange={() => toggleCheck("sim")} />
          </label>

          <label className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 transition ${checkedItems.invoice ? "border-safe bg-safe-bg" : "border-hairline bg-surface hover:bg-canvas"}`}>
            <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checkedItems.invoice ? "border-safe bg-safe text-white" : "border-muted bg-white"}`}>
              {checkedItems.invoice && <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Mobile Purchase Invoice</p>
              <p className="text-xs text-muted">A copy of your original purchase receipt (optional but highly recommended) and identity proof.</p>
            </div>
            <input type="checkbox" className="hidden" checked={checkedItems.invoice} onChange={() => toggleCheck("invoice")} />
          </label>
        </div>
      </div>

      {/* ── Call to Action ── */}
      <div className="mt-auto border-t border-hairline bg-surface pt-4">
        {!allReady && (
          <p className="mb-3 text-center text-xs font-semibold text-caution">
            ⚠️ Please complete the checklist above to proceed.
          </p>
        )}
        <a
          href="https://www.ceir.gov.in/Request/CeirUserBlockRequestDirect.jsp"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!allReady) {
              e.preventDefault();
              alert("Please acknowledge that you have the mandatory documents ready by checking the boxes above.");
            }
          }}
          className={`flex w-full items-center justify-center gap-2 rounded-card py-3.5 text-sm font-bold transition ${
            allReady
              ? "bg-navy text-white hover:bg-navy/90 active:scale-[0.98]"
              : "cursor-not-allowed bg-hairline text-muted"
          }`}
        >
          Proceed to Official CEIR Portal
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <p className="mt-3 text-center text-[10px] uppercase tracking-widest text-muted">
          You will be redirected securely
        </p>
      </div>

    </Layout>
  );
}
