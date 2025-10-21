import { useEffect, useState } from 'react'

interface LogoAnalysis {
  needsContrast: boolean
  isAnalyzing: boolean
}

/**
 * Hook que analiza una imagen de logo para determinar si necesita contraste en modo oscuro.
 * Detecta si:
 * 1. La imagen es monocromática (un solo color dominante)
 * 2. El color dominante es oscuro
 *
 * Si ambas condiciones se cumplen, retorna needsContrast = true
 */
export const useLogoContrast = (imageUrl: string | null | undefined, isDarkMode: boolean): LogoAnalysis => {
  const [needsContrast, setNeedsContrast] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    if (!imageUrl || !isDarkMode) {
      setNeedsContrast(false)
      return
    }

    setIsAnalyzing(true)

    const analyzeImage = async () => {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Error al cargar imagen'))
          img.src = imageUrl
        })

        // Crear canvas para analizar la imagen
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        if (!ctx) {
          setNeedsContrast(false)
          setIsAnalyzing(false)
          return
        }

        // Escalar imagen para análisis rápido (max 100x100)
        const maxSize = 100
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = img.width * scale
        canvas.height = img.height * scale

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data

        // Analizar colores
        let totalR = 0, totalG = 0, totalB = 0
        let opaquePixels = 0
        const colorFrequency = new Map<string, number>()

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          const a = pixels[i + 3]

          // Ignorar píxeles transparentes
          if (a < 50) continue

          opaquePixels++
          totalR += r
          totalG += g
          totalB += b

          // Agrupar colores similares (reducir a 16 tonos por canal)
          const colorKey = `${Math.floor(r / 16)}-${Math.floor(g / 16)}-${Math.floor(b / 16)}`
          colorFrequency.set(colorKey, (colorFrequency.get(colorKey) || 0) + 1)
        }

        if (opaquePixels === 0) {
          setNeedsContrast(false)
          setIsAnalyzing(false)
          return
        }

        // Calcular color promedio
        const avgR = totalR / opaquePixels
        const avgG = totalG / opaquePixels
        const avgB = totalB / opaquePixels

        // Calcular brillo usando fórmula de luminancia percibida
        const brightness = (avgR * 0.299 + avgG * 0.587 + avgB * 0.114)

        // Detectar si es monocromático
        // Si un color domina más del 60% de los píxeles, se considera monocromático
        const sortedColors = Array.from(colorFrequency.entries())
          .sort((a, b) => b[1] - a[1])

        const dominantColorPercentage = sortedColors[0]?.[1] / opaquePixels || 0
        const isMonochromatic = dominantColorPercentage > 0.6

        // Detectar si es oscuro (brillo < 80 en escala 0-255)
        const isDark = brightness < 80

        // Solo aplicar contraste si es monocromático Y oscuro
        const shouldApplyContrast = isMonochromatic && isDark

        setNeedsContrast(shouldApplyContrast)
        setIsAnalyzing(false)
      } catch (error) {
        // Si hay error en el análisis, no aplicar contraste
        setNeedsContrast(false)
        setIsAnalyzing(false)
      }
    }

    analyzeImage()
  }, [imageUrl, isDarkMode])

  return { needsContrast, isAnalyzing }
}
