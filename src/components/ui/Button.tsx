import React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "soft" | "danger";
  fullWidth?: boolean;
};

function joinClasses(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

const VARIANT_CLASSES: Record<
  NonNullable<ButtonProps["variant"]>,
  string
> = {
  primary:
    "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800",
  secondary:
    "bg-slate-800 text-white hover:bg-slate-900 active:bg-slate-950",
  soft:
    "bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300",
  danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
};

const DISABLED_CLASSES =
  "opacity-60 cursor-not-allowed pointer-events-none";

const BASE_CLASSES =
  "rounded-2xl px-4 py-4 text-lg font-semibold transition focus:outline-none";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      fullWidth,
      className,
      type,
      disabled,
      ...rest
    },
    ref
  ) => {
    const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
    const widthClass = fullWidth ? "w-full" : "";
    const disabledClass = disabled ? DISABLED_CLASSES : "";
    return (
      <button
        ref={ref}
        type={type}
        className={joinClasses(
          BASE_CLASSES,
          variantClass,
          widthClass,
          disabledClass,
          className
        )}
        disabled={disabled}
        {...rest}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;