import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number;
  onValueChange: (value: number) => void;
}

export function CurrencyInput({ value, onValueChange, className, ...props }: CurrencyInputProps) {
  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [display, setDisplay] = useState(formatCurrency(value));
  const internalChange = useRef(false);

  useEffect(() => {
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    setDisplay(formatCurrency(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    internalChange.current = true;
    if (raw === "" || raw === "0") {
      setDisplay("");
      onValueChange(0);
      return;
    }
    const cents = parseInt(raw, 10);
    const newValue = cents / 100;
    setDisplay(formatCurrency(newValue));
    onValueChange(newValue);
  };

  const handleBlur = () => {
    if (!display) {
      setDisplay(formatCurrency(0));
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">R$</span>
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        className={cn("pl-10", className)}
      />
    </div>
  );
}
