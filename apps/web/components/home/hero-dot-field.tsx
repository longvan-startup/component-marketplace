'use client'

import { useRef } from 'react'
import { useDotPress } from './use-dot-press'

/* Canvas layer for the halftone dots. The drawing lives in useDotPress. */
export function HeroDotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useDotPress(canvasRef)

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" />
}
