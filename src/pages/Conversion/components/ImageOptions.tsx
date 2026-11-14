import { TriangleAlert } from "lucide-react";
import Select from "../../../components/ui/Select";
import type { ConversionOptions } from "../../../contexts/ConversionQueueContext";
import type { BookWithThumbnail } from "../../../types/LibraryTypes";
import { useTranslation } from "../../../i18n/useTranslation";
import {
  DEFAULT_CUSTOM_IMAGE_SETTINGS,
  IMAGE_DIMENSION_LIMITS,
  IMAGE_PRESET_IDS,
  IMAGE_QUALITY_LIMITS,
  KINDLE_IMAGE_PRESETS,
  isKindleImagePreset,
  type ImagePresetId,
} from "../../../lib/lyceum/images/imagePresets";
import { NumberOption, RangeOption, ToggleOption } from "./OptionControls";
import { ConversionPreview } from "./ConversionPreview";

/** Fields that, when edited by hand, turn a named preset into "custom". */
type ManualImageField = "imageMaxWidth" | "imageMaxHeight" | "imageQuality";

function presetUpdates(preset: ImagePresetId, current: ConversionOptions): Partial<ConversionOptions> {
  if (isKindleImagePreset(preset)) {
    const values = KINDLE_IMAGE_PRESETS[preset];
    return {
      imagePreset: preset,
      imageMaxWidth: values.maxWidth,
      imageMaxHeight: values.maxHeight,
      imageQuality: values.quality,
      imageGrayscale: values.grayscale,
      kindleProfile: values.kindleProfile,
    };
  }
  if (preset === "custom" && current.imagePreset === "original") {
    return {
      imagePreset: "custom",
      imageMaxWidth: DEFAULT_CUSTOM_IMAGE_SETTINGS.maxWidth,
      imageMaxHeight: DEFAULT_CUSTOM_IMAGE_SETTINGS.maxHeight,
      imageQuality: DEFAULT_CUSTOM_IMAGE_SETTINGS.quality,
    };
  }
  return { imagePreset: preset };
}

export function ImageOptions({
  book,
  options,
  onChange,
}: {
  book: BookWithThumbnail;
  options: ConversionOptions;
  onChange: (updates: Partial<ConversionOptions>) => void;
}) {
  const { t } = useTranslation();
  const preset = options.imagePreset;
  const showLimits = preset !== "original";

  const editManually = (field: ManualImageField, value: number) => {
    onChange({ [field]: value, ...(isKindleImagePreset(preset) ? { imagePreset: "custom" as const } : {}) });
  };

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-snug text-foreground-subtle">{t("conversion:options.images.description")}</p>

      <label className="block space-y-1 text-xs text-foreground-muted">
        <span>{t("conversion:options.images.preset")}</span>
        <Select
          value={preset}
          onChange={(value) => onChange(presetUpdates(value as ImagePresetId, options))}
          className="h-9 w-full text-sm"
          items={IMAGE_PRESET_IDS.map((id) => ({ value: id, label: t(`conversion:options.images.presets.${id}`) }))}
        />
      </label>

      {showLimits ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberOption
              label={t("conversion:options.images.maxWidth")}
              value={options.imageMaxWidth}
              min={IMAGE_DIMENSION_LIMITS.min}
              max={IMAGE_DIMENSION_LIMITS.max}
              suffix="px"
              onChange={(value) => editManually("imageMaxWidth", value)}
            />
            <NumberOption
              label={t("conversion:options.images.maxHeight")}
              value={options.imageMaxHeight}
              min={IMAGE_DIMENSION_LIMITS.min}
              max={IMAGE_DIMENSION_LIMITS.max}
              suffix="px"
              onChange={(value) => editManually("imageMaxHeight", value)}
            />
          </div>
          <RangeOption
            label={t("conversion:options.images.quality")}
            value={options.imageQuality}
            min={IMAGE_QUALITY_LIMITS.min}
            max={IMAGE_QUALITY_LIMITS.max}
            hint={t("conversion:options.images.qualityHint")}
            onChange={(value) => editManually("imageQuality", value)}
          />
        </>
      ) : (
        <p className="text-[11px] leading-snug text-foreground-subtle">{t("conversion:options.images.originalHint")}</p>
      )}

      <ToggleOption
        label={t("conversion:options.images.grayscale")}
        checked={options.imageGrayscale}
        onChange={() => onChange({ imageGrayscale: !options.imageGrayscale })}
        hint={t("conversion:options.images.grayscaleHint")}
      />
      {preset === "kindle-colorsoft" && options.imageGrayscale && (
        <p className="flex items-start gap-2 text-[11px] leading-snug text-warning">
          <TriangleAlert size={13} className="mt-0.5 flex-none" />
          <span>{t("conversion:options.images.colorDeviceWarning")}</span>
        </p>
      )}

      <ConversionPreview book={book} options={options} />
    </div>
  );
}
