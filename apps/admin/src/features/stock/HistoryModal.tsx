import { useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { q, useLoad } from '../../lib/db'
import { formatDateTime, formatQty } from '../../lib/format'
import type { StockMovement } from '../../lib/types'
import { ErrorNote, Modal } from '../../components/ui'
import { loadPeople } from './data'

const TYPE_LABEL: Record<StockMovement['movement_type'], string> = {
  purchase: 'Purchase',
  sale: 'Sale',
  adjustment: 'Adjustment',
  count_correction: 'Stock count',
  opening_stock: 'Opening stock',
  return: 'Return',
}

export default function HistoryModal({ productId, name, unit, onClose }: { productId: string; name: string; unit: string; onClose: () => void }) {
  const load = useCallback(async () => {
    const [moves, people] = await Promise.all([
      q<StockMovement[]>(
        supabase
          .from('stock_movements')
          .select('id,movement_type,quantity_change,reason,created_by,created_at')
          .eq('product_id', productId)
          .order('created_at', { ascending: false })
          .limit(60),
      ),
      loadPeople(),
    ])
    return { moves, people }
  }, [productId])
  const { data, error, loading } = useLoad(load)

  return (
    <Modal title={`Stock history · ${name}`} onClose={onClose}>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !data?.moves.length ? (
        <p className="py-6 text-center text-sm text-muted">Nothing recorded for this product yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.moves.map((m) => {
            const up = Number(m.quantity_change) > 0
            return (
              <li key={m.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{TYPE_LABEL[m.movement_type]}</div>
                  {m.reason && <div className="text-sm text-muted">{m.reason}</div>}
                  <div className="mt-0.5 text-xs text-muted">
                    {formatDateTime(m.created_at)}
                    {m.created_by && ` · ${data.people.get(m.created_by) ?? 'Team member'}`}
                  </div>
                </div>
                <div className={`shrink-0 text-sm font-bold ${up ? 'text-primary' : 'text-danger'}`}>
                  {up ? '+' : ''}{formatQty(m.quantity_change)} {unit}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
