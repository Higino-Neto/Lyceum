import { Folder, FolderSync, Usb } from "lucide-react";
import { motion } from "motion/react";
import { springFast } from "../../../utils/motionPresets";
import { LibrarySection } from "../../../types/LibraryTypes";

interface SectionTabsProps {
  activeSection: LibrarySection;
  onSectionChange: (section: LibrarySection) => void;
  syncedCount: number;
  unsyncedCount: number;
  usbCount: number;
}

export default function SectionTabs({
  activeSection,
  onSectionChange,
  syncedCount,
  unsyncedCount,
  usbCount,
}: SectionTabsProps) {
  const sections = [
    {
      id: "synced" as LibrarySection,
      label: "Sincronizados",
      count: syncedCount,
      icon: FolderSync,
    },
    {
      id: "unsynced" as LibrarySection,
      label: "Não sincronizados",
      count: unsyncedCount,
      icon: Folder,
    },
    {
      id: "usb" as LibrarySection,
      label: "Dispositivos USB",
      count: usbCount,
      icon: Usb,
    },
  ];

  return (
    <div className="flex items-center rounded-sm border border-zinc-800 bg-zinc-950 p-0.5">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;

        return (
          <motion.button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`relative flex h-8 cursor-pointer items-center gap-2 rounded-sm px-3 text-xs transition-colors ${
              isActive
                ? "text-zinc-950"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId="library-section-active"
                className="absolute inset-0 rounded-sm bg-green-500"
                transition={springFast}
              />
            )}
            <Icon size={14} className="relative z-10" />
            <span className="relative z-10">{section.label}</span>
            <span className="relative z-10 rounded-sm bg-black/10 px-1.5 text-[11px]">
              {section.count}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
