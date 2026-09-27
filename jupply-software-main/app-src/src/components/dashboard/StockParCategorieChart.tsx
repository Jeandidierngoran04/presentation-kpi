import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { StockParCategorie } from '../../types/stock'
import { useChartTheme } from '../../lib/chartTheme'
import { SectionCard } from './SectionCard'

export function StockParCategorieChart({ donnees }: { donnees: StockParCategorie[] }) {
  const t = useChartTheme()
  return (
    <SectionCard titre="Stock par catégorie">
      {donnees.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">Aucune donnée disponible.</p>
      ) : (
        <div style={{ width: '100%', height: Math.max(donnees.length * 36, 140) }}>
          <ResponsiveContainer>
            <BarChart data={donnees} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke={t.grid} />
              <XAxis type="number" tick={{ fontSize: 11, fill: t.axis }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="categorie_nom"
                tick={{ fontSize: 12, fill: t.axisStrong }}
                axisLine={false}
                tickLine={false}
                width={140}
              />
              <Tooltip
                cursor={{ fill: t.cursor }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${t.tooltipBorder}`,
                  background: t.tooltipBg,
                  color: t.tooltipText,
                }}
                formatter={(valeur) => [valeur, 'Quantité']}
              />
              <Bar dataKey="quantite_totale" radius={[0, 6, 6, 0]} barSize={16}>
                {donnees.map((_, index) => (
                  <Cell key={index} fill={t.categories[index % t.categories.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  )
}
