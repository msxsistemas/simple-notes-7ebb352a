import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CountryCodeSelectProps {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

export function CountryCodeSelect({ value, onChange, className }: CountryCodeSelectProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const cleaned = draft.replace(/\D/g, "");
    if (cleaned) {
      onChange(cleaned);
    } else {
      setDraft(value);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "inline-flex items-center justify-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm h-10 shrink-0 cursor-pointer hover:bg-muted/80 transition-colors min-w-[60px]",
          className
        )}
      >
        +{value}
      </button>
    );
  }

  return (
    <div className={cn("relative shrink-0", className)}>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">+</span>
      <Input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setDraft(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        className="w-[70px] rounded-r-none border-r-0 pl-5 pr-1 text-sm h-10"
      />
    </div>
  );
}

export const countryCodes = [
  { code: "55", label: "🇧🇷 +55", country: "Brasil" },
];
