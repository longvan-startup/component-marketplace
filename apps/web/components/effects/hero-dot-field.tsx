'use client'

import { useRef } from 'react'
import { type DotPressOptions, useDotPress } from './use-dot-press'

/* Canvas layer for the halftone dots. The drawing lives in useDotPress. */
export function HeroDotField(options: DotPressOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useDotPress(canvasRef, options)

  return <canvas ref={canvasRef} className="absolute inset-0 size-full" />
}
