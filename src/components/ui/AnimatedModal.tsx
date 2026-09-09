import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

interface AnimatedModalProps {
  open: boolean;
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  onBackdropClick?: () => void;
}

export default function AnimatedModal({
  open,
  children,
  className = "",
  backdropClassName = "",
  ariaLabel,
  ariaLabelledBy,
  onBackdropClick,
}: AnimatedModalProps) {
  const osReducedMotion = useReducedMotion();
  const reduceMotion = osReducedMotion ||
    (typeof document !== "undefined" && document.documentElement.dataset.reducedEffects === "true");

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 ${backdropClassName}`}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onBackdropClick?.();
          }}
        >
          <motion.div
            className={className}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
            transition={reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 430, damping: 34, mass: 0.72 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
