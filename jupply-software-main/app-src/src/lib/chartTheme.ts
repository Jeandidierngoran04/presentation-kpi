import { useTheme } from '../context/ThemeContext'

/** Couleurs des graphiques Recharts, alignees sur la charte et le theme actif. */
export function useChartTheme() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    grid: dark ? '#1F2937' : '#E5E7EB',
    axis: dark ? '#9CA3AF' : '#6B7280',
    axisStrong: dark ? '#F9FAFB' : '#18181B',
    tooltipBg: dark ? '#111827' : '#FFFFFF',
    tooltipBorder: dark ? '#1F2937' : '#E5E7EB',
    tooltipText: dark ? '#F9FAFB' : '#18181B',
    cursor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    categories: dark
      ? ['#4ADE80', '#A3E635', '#2DD4BF', '#38BDF8', '#FBBF24', '#F472B6', '#94A3B8']
      : ['#22C55E', '#84CC16', '#14B8A6', '#0EA5E9', '#F59E0B', '#EC4899', '#64748B'],
  }
}
