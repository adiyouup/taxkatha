"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/** Toasts sit on navy with a gold hairline — the site has no theme switcher. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-gold-500" />,
        info: <InfoIcon className="size-4 text-gold-500" />,
        warning: <TriangleAlertIcon className="size-4 text-gold-300" />,
        error: <OctagonXIcon className="size-4 text-[#f2867e]" />,
        loading: <Loader2Icon className="size-4 animate-spin text-gold-500" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-navy-900)",
          "--normal-text": "var(--color-paper)",
          "--normal-border": "rgb(212 175 55 / 0.35)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans shadow-lift",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
