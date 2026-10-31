import React from 'react';
import Svg, { Polygon, Polyline } from 'react-native-svg';

/**
 * Small trend line with a soft area fill, matching the company database cards.
 * Data is drawn oldest to newest; `height` is the rendered height in points.
 */
export function Sparkline({
  data,
  color,
  height = 54,
  width = 300,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <Polygon points={`0,${height} ${points} ${width},${height}`} fill={color} opacity={0.12} />
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
