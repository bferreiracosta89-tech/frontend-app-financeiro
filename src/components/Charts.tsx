import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../utils/theme';
import { fmtBRL } from '../utils/format';

interface Slice { label: string; value: number; color: string; }

/** Gráfico de rosca SVG sem dependências externas. */
export const DonutChart: React.FC<{ data: Slice[]; size?: number; thickness?: number }> = ({
  data, size = 200, thickness = 28,
}) => {
  const total = data.reduce((a, s) => a + s.value, 0) || 1;
  const radius = size / 2 - thickness / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {data.map((s, i) => {
            const len = (s.value / total) * circumference;
            const el = (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={s.color}
                strokeWidth={thickness}
                fill="transparent"
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </G>
        <SvgText
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          fontSize={12}
          fill={COLORS.muted}
        >
          Total
        </SvgText>
        <SvgText
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          fontSize={14}
          fontWeight="bold"
          fill={COLORS.text}
        >
          {fmtBRL(total)}
        </SvgText>
      </Svg>
      <View style={{ marginTop: 12, width: '100%' }}>
        {data.map((s, i) => (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 3 }}
          >
            <View style={{ width: 12, height: 12, backgroundColor: s.color, borderRadius: 2 }} />
            <Text style={{ marginLeft: 8, color: COLORS.text, flex: 1 }}>{s.label}</Text>
            <Text style={{ color: COLORS.muted }}>
              {fmtBRL(s.value)} · {((s.value / total) * 100).toFixed(0)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

interface Bar { label: string; value: number; }

/** Gráfico de barras horizontais simples. */
export const HBarChart: React.FC<{
  data: Bar[];
  color?: string;
  height?: number;
}> = ({ data, color = COLORS.info, height = 18 }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View>
      {data.map((d, i) => (
        <View key={i} style={{ marginVertical: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: COLORS.text, fontSize: 13 }} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={{ color: COLORS.muted, fontSize: 13 }}>{fmtBRL(d.value)}</Text>
          </View>
          <View
            style={{
              height,
              backgroundColor: COLORS.border,
              borderRadius: height / 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${(d.value / max) * 100}%`,
                height: '100%',
                backgroundColor: color,
                borderRadius: height / 2,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

/** Barra de progresso simples para "X de Y parcelas pagas". */
export const ProgressBar: React.FC<{
  value: number;
  max: number;
  color?: string;
  height?: number;
  label?: string;
}> = ({ value, max, color = COLORS.success, height = 8, label }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <View>
      {label && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 12, color: COLORS.muted }}>{label}</Text>
          <Text style={{ fontSize: 12, color: COLORS.muted }}>{value}/{max} ({pct.toFixed(0)}%)</Text>
        </View>
      )}
      <View
        style={{
          height,
          backgroundColor: COLORS.border,
          borderRadius: height / 2,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: height / 2,
          }}
        />
      </View>
    </View>
  );
};
