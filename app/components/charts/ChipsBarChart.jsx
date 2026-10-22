import { getTrendColors } from '@/lib/format';

/* =====================================================
   ChipsBarChart - 三大法人柱狀圖
   ===================================================== */
export function ChipsBarChart({ chips }) {
  const targets = [{ label: '外資 (FI)', val: chips.foreign }, { label: '投信 (IT)', val: chips.trust }, { label: '自營商 (DL)', val: chips.dealer }];
  return (
    <div className="space-y-3 flex-1 flex flex-col justify-center">
      {targets.map((t, i) => {
        const trend = getTrendColors(t.val);
        const widthPercent = Math.min(100, (Math.abs(t.val) / 4500) * 100);
        return (
          <div key={i} className="text-xs">
            <div className="flex justify-between mb-1 text-fg font-black">
              <span>{t.label}</span>
              <span className={'font-mono font-black ' + trend.text}>{t.val > 0 ? '+' : ''}{t.val}</span>
            </div>
            <div className="h-4 bg-surface-raised border-2 border-line-strong rounded flex overflow-hidden">
              <div className="w-1/2 flex justify-end pr-px">{t.val < 0 && <div style={{ width: widthPercent + '%' }} className={trend.solidBg + ' opacity-95'} />}</div>
              <div className="w-1/2 flex justify-start pl-px">{t.val >= 0 && <div style={{ width: widthPercent + '%' }} className={trend.solidBg + ' opacity-95'} />}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
