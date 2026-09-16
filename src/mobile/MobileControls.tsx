import { ChevronDown, type LucideIcon } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

interface FieldFrameProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function MobileFieldFrame({ label, htmlFor, hint, error, children }: FieldFrameProps) {
  return (
    <div className="mobile-control-group">
      <label className="mobile-control-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="mobile-field-error" role="alert">{error}</p> : hint ? <p className="mobile-control-hint">{hint}</p> : null}
    </div>
  );
}

export function MobileInput({ icon: Icon, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }) {
  return (
    <div className="mobile-input-shell">
      {Icon ? <Icon aria-hidden="true" className="mobile-input-icon" size={19} /> : null}
      <input {...props} className={`mobile-field ${Icon ? "mobile-field-with-icon" : ""} ${className}`} />
    </div>
  );
}

export function MobileSelect({ icon: Icon, className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { icon?: LucideIcon }) {
  return (
    <div className="mobile-select-shell">
      {Icon ? <Icon aria-hidden="true" className="mobile-input-icon" size={19} /> : null}
      <select {...props} className={`mobile-field mobile-select ${Icon ? "mobile-field-with-icon" : ""} ${className}`}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="mobile-select-chevron" size={18} />
    </div>
  );
}

export function MobileCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mobile-card ${className}`}>{children}</section>;
}

