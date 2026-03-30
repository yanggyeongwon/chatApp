"use client"

import { useEffect, useState } from "react"

export function ElectronTitlebar() {
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    setIsElectron(navigator.userAgent.includes("Electron"))
  }, [])

  if (!isElectron) return null

  return (
    <div
      style={{ height: 38, WebkitAppRegion: "drag" } as React.CSSProperties}
      className="w-full flex-shrink-0"
    />
  )
}
