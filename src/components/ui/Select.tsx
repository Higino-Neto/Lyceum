import * as RadixSelect from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";

interface SelectItem {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  items: SelectItem[];
  placeholder?: string;
}

export default function Select({
  value,
  onChange,
  items,
  placeholder,
}: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange}>
      <RadixSelect.Trigger className="flex h-7 cursor-pointer items-center gap-2 rounded-sm bg-transparent px-0 text-xs text-zinc-300 outline-none">
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown size={12} className="text-zinc-500" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content className="z-50 min-w-[180px] overflow-hidden rounded-sm border border-zinc-700 bg-zinc-900 shadow-xl">
          <RadixSelect.Viewport>
            {items.map((item) => (
              <RadixSelect.Item
                key={item.value}
                value={item.value}
                className="flex cursor-pointer items-center px-3 py-2 text-xs text-zinc-300 outline-none transition-colors hover:bg-zinc-800 hover:text-zinc-100 data-[highlighted]:bg-zinc-800 data-[highlighted]:text-zinc-100 data-[state=checked]:text-green-400"
              >
                <RadixSelect.ItemText>{item.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
