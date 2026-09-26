import { Folder, FolderSync, Usb } from "lucide-react";
import { LibrarySection } from "../../../types/LibraryTypes";
import { useTranslation, type TranslationKey } from "../../../i18n";

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
  const { t } = useTranslation();
  const sections: {
    id: LibrarySection;
    labelKey: TranslationKey;
    count: number;
    icon: typeof Folder;
  }[] = [
    {
      id: "synced" as LibrarySection,
      labelKey: "library:sections.synced",
      count: syncedCount,
      icon: FolderSync,
    },
    {
      id: "unsynced" as LibrarySection,
      labelKey: "library:sections.unsynced",
      count: unsyncedCount,
      icon: Folder,
    },
    {
      id: "usb" as LibrarySection,
      labelKey: "library:sections.usb",
      count: usbCount,
      icon: Usb,
    },
  ];

  return (
    <div className="flex min-w-0 items-center overflow-hidden rounded-sm border border-zinc-800 bg-zinc-950 p-0.5">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;

        return (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            title={t("library:sections.titleWithCount", {
              label: t(section.labelKey),
              count: section.count,
            })}
            className={`relative flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-sm px-2 text-xs transition-colors sm:gap-2 sm:px-3 ${
              isActive
                ? "bg-green-500 text-zinc-950"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
          >
            <Icon size={14} className="relative z-10 flex-shrink-0" />
            <span className="relative z-10 hidden min-w-0 max-w-28 truncate sm:inline lg:max-w-36">
              {t(section.labelKey)}
            </span>
            <span className="relative z-10 rounded-sm bg-black/10 px-1.5 text-[11px]">
              {section.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
