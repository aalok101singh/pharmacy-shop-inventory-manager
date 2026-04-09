import React, { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  containerClassName?: string;
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      containerClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const computedId =
      id || (label ? `input-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
    return (
      <div className={containerClassName ? containerClassName : ""}>
        {label && (
          <label
            htmlFor={computedId}
            className="block mb-1 text-base font-medium text-slate-700"
          >
            {label}
          </label>
        )}
        <input
          id={computedId}
          ref={ref}
          className={[
            "w-full rounded-2xl border",
            "px-4 py-3",
            "text-lg",
            "bg-white text-slate-900",
            "outline-none",
            error
              ? "border-red-400 focus:border-red-500"
              : "border-slate-300 focus:border-blue-500",
            "transition-colors",
            className || "",
          ].join(" ")}
          {...props}
        />
        {error && (
          <span className="block mt-1 text-sm text-red-500 font-medium">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;