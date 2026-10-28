import { useState } from "react";
import AiDesigner from "./AiDesigner";

export default function AiHelpWidget() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="ai-help-float" onClick={() => setOpen(true)} aria-label="Ask GETCYB AI for help"><span aria-hidden="true">✦</span><b>Ask AI</b></button>
    {open && <AiDesigner model={{}} onApply={() => {}} onClose={() => setOpen(false)} initialTab="help" />}
  </>;
}
