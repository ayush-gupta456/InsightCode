import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
export function AnimatedIcon({
  icon: Icon,
  size = 20,
  kind = "lift",
  className = "",
}: {
  icon: LucideIcon;
  size?: number;
  kind?: "lift" | "arrow" | "turn";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`animated-icon icon-${kind} ${className}`}
    >
      <Icon size={size} strokeWidth={1.7} />
    </span>
  );
}
