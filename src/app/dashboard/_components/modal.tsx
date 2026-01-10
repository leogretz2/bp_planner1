"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  anchorElement?: HTMLElement | null;
}

// Hook to detect prefers-reduced-motion
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

// Animation variants
const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const popoverVariants = {
  hidden: { opacity: 0, scale: 0.98, y: 4 },
  visible: { opacity: 1, scale: 1, y: 0 },
};

const springTransition = {
  type: "spring" as const,
  stiffness: 400,
  damping: 28,
  duration: 0.35,
};

const exitTransition = {
  duration: 0.2,
  ease: [0.4, 0, 1, 1],
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  anchorElement,
}: ModalProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!isOpen || !anchorElement || !popoverRef.current) return;

    // Position the popover near the anchor element
    const anchorRect = anchorElement.getBoundingClientRect();
    const popover = popoverRef.current;

    // Position to the right of the anchor, or left if not enough space
    const spaceOnRight = window.innerWidth - anchorRect.right;
    const popoverWidth = 360;

    if (spaceOnRight >= popoverWidth + 16) {
      // Position to the right
      popover.style.left = `${anchorRect.right + 8}px`;
    } else {
      // Position to the left
      popover.style.left = `${anchorRect.left - popoverWidth - 8}px`;
    }

    // Align top with anchor, but keep within viewport
    const topPosition = Math.max(16, Math.min(anchorRect.top, window.innerHeight - popover.offsetHeight - 16));
    popover.style.top = `${topPosition}px`;
  }, [isOpen, anchorElement]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Reduced motion: simple fade only
  if (prefersReducedMotion) {
    if (!isOpen) return null;

    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/10" />
        <div
          ref={popoverRef}
          className="fixed z-50 w-[360px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 transition hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      </>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/10"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
          />

          {/* Popover */}
          <motion.div
            ref={popoverRef}
            className="fixed z-50 w-[360px] rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{
              ...springTransition,
              exit: exitTransition,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 transition hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
