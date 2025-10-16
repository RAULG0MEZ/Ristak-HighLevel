import { useCallback, useRef, useEffect } from 'react'

interface PointPosition {
  x: number
  y: number
}

export const useChartPoint = () => {
  const pointsRef = useRef<Map<string, PointPosition>>(new Map())

  // Función para registrar la posición de un punto
  const registerPoint = useCallback((index: number, serieKey: string, x: number, y: number) => {
    const key = `${index}-${serieKey}`
    pointsRef.current.set(key, { x, y })
  }, [])

  // Función para obtener la posición de un punto
  const getPointPosition = useCallback((index: number, serieKey: string = 'value'): PointPosition | null => {
    const key = `${index}-${serieKey}`
    return pointsRef.current.get(key) || null
  }, [])

  // Función para obtener la posición promedio si hay múltiples series
  const getAveragePointPosition = useCallback((index: number, seriesKeys: string[]): PointPosition | null => {
    const positions = seriesKeys
      .map(key => getPointPosition(index, key))
      .filter(pos => pos !== null) as PointPosition[]

    if (positions.length === 0) return null

    // Si solo hay una posición, devolverla
    if (positions.length === 1) return positions[0]

    // Calcular el promedio de X (debería ser la misma) y Y
    const avgX = positions.reduce((sum, pos) => sum + pos.x, 0) / positions.length
    const avgY = positions.reduce((sum, pos) => sum + pos.y, 0) / positions.length

    return { x: avgX, y: avgY }
  }, [getPointPosition])

  // Limpiar las posiciones cuando el componente se desmonte
  useEffect(() => {
    return () => {
      pointsRef.current.clear()
    }
  }, [])

  return {
    registerPoint,
    getPointPosition,
    getAveragePointPosition
  }
}