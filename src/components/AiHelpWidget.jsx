import { lazy, Suspense, useState } from "react";
import "../styles/aiDesigner.css";

const AiDesigner = lazy(() => import("./AiDesigner"));

export default function AiHelpWidget({ publicMode = false }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="ai-help-float" onClick={() => setOpen(true)} aria-label="Ask CYB AI for help"><span aria-hidden="true">✦</span><b>Ask AI</b></button>
    {open && <Suspense fallback={<span role="status">Loading AI help…</span>}><AiDesigner model={{}} onApply={() => {}} onClose={() => setOpen(false)} initialTab="help" publicMode={publicMode} /></Suspense>}
  </>;
}
