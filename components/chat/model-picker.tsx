"use client";

import { MANUAL_MODELS } from "@/lib/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const current = MANUAL_MODELS.find((m) => m.value === value);
  const label = current?.label ?? "Auto";

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-[11px] font-medium border-border/60 bg-transparent hover:bg-accent rounded-full px-2.5 gap-1 text-muted-foreground hover:text-foreground transition-colors w-auto max-w-[180px] focus:ring-0 focus:ring-offset-0">
        <SelectValue placeholder="Auto">
          <span className="truncate">{label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="text-xs rounded-xl border-border shadow-xl">
        {MANUAL_MODELS.map((m) => (
          <SelectItem
            key={m.value}
            value={m.value}
            className="text-[12px] rounded-lg"
          >
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
