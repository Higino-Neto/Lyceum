import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

export interface SelectItem {
  value: string;
  label: string;
}

// Radix reserves the empty string for clearing a selection. Keeping this
// conversion inside the shared control lets callers retain native-select
// semantics for meaningful "root" / "all" options.
const EMPTY_VALUE = "__lyceum_empty_select_value__";
const toRadixValue = (value: string) => value === "" ? EMPTY_VALUE : value;
const fromRadixValue = (value: string) => value === EMPTY_VALUE ? "" : value;

interface SelectProps {
  value?: string;
  onChange: (value: string) => void;
  items: SelectItem[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function Select({
  value,
  onChange,
  items,
  placeholder,
  disabled,
  className,
  ariaLabel,
}: SelectProps) {
  return (
    <RadixSelect.Root
      value={value === undefined ? undefined : toRadixValue(value)}
      onValueChange={(nextValue) => onChange(fromRadixValue(nextValue))}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        className={`
          flex h-8 min-w-[160px] items-center justify-between
          gap-2 rounded-md border border-border
          bg-surface px-3
          text-xs text-foreground-muted
          outline-none transition-colors

          hover:border-border-strong

          outline-none
          focus:outline-none
          focus-visible:outline-none
          focus:ring-0
          focus-visible:ring-0

          data-[placeholder]:text-foreground-subtle
          data-[state=open]:border-primary

          disabled:cursor-not-allowed
          disabled:opacity-50
        ${className ?? ""}`}
        aria-label={ariaLabel}
      >
        <RadixSelect.Value placeholder={placeholder} />

        <RadixSelect.Icon>
          <ChevronDown size={14} className="text-foreground-subtle" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className="
            z-[9999] min-w-[var(--radix-select-trigger-width)]
            overflow-hidden rounded-md
            border border-border-strong
            bg-surface
            p-1 shadow-xl

          outline-none
          focus:outline-none
          focus-visible:outline-none
          focus:ring-0
          focus-visible:ring-0
          "
        >
          <RadixSelect.Viewport>
            {items.map((item) => (
              <RadixSelect.Item
                key={item.value}
                value={toRadixValue(item.value)}
                className="
                  relative flex cursor-pointer
                  items-center rounded-sm
                  px-3 py-2 pl-8
                  text-xs text-foreground-muted
                  outline-none transition-colors

                  data-[highlighted]:bg-surface-muted
                  data-[highlighted]:text-foreground
                "
              >
                <RadixSelect.ItemIndicator
                  className="absolute left-2"
                >
                  <Check size={12} />
                </RadixSelect.ItemIndicator>

                <RadixSelect.ItemText>
                  {item.label}
                </RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
