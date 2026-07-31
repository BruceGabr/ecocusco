import React, { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "default", size = "md", className = "", type = "button", ...rest }: ButtonProps) {
  const classes = ["btn", variant !== "default" ? variant : "", size === "sm" ? "sm" : "", className].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...rest} />;
}

export default Button;
