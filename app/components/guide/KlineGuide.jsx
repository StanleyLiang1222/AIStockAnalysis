'use client';

import { useState, useMemo } from 'react';
import { KlineDetailIcon } from '@/app/components/charts/KlineDetailIcon';
import { KLINE_TEMPLATES } from './klineTemplates';

/**
 * K 線型態圖典主面板元件
 */
export function KlineGuide() {
  const [filter, setFilter] = useState('all'); // 'all' | 'up' | 'down' | 'cross'

  const filteredTemplates = useMemo(() => {
    if (filter === 'all') return KLINE_TEMPLATES;
    return KLINE_TEMPLATES.filter(t => t.type === filter);
  }, [filter]);

  return (
    <div className="w-full space-y-5 fade-in-up">
      <div className="bg-surface border-2 border-line rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base font-black text-fg flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block"></span>
            K 線經典型態圖典
          </h2>
          <p className="text-xs text-fg-muted font-bold mt-1">
            收錄 13 種技術分析必學 K 線型態。圖示中的導引點線即時呈現「開、高、低、收」的對應邏輯。
          </p>
        </div>
        <div className="flex bg-inset p-1 rounded-lg border-2 border-line text-xs font-black self-stretch md:self-auto justify-between md:justify-start gap-1">
          <button onClick={() => setFilter('all')} className={'px-3.5 py-1.5 rounded-md transition-all ' + (filter === 'all' ? 'bg-line text-fg border border-line-strong shadow' : 'text-fg-faint hover:text-fg')}>全部 ({KLINE_TEMPLATES.length})</button>
          <button onClick={() => setFilter('up')} className={'px-3.5 py-1.5 rounded-md transition-all ' + (filter === 'up' ? 'bg-line text-up border border-up/20 shadow' : 'text-fg-faint hover:text-fg')}>陽線 ({KLINE_TEMPLATES.filter(t => t.type === 'up').length})</button>
          <button onClick={() => setFilter('down')} className={'px-3.5 py-1.5 rounded-md transition-all ' + (filter === 'down' ? 'bg-line text-down border border-down/20 shadow' : 'text-fg-faint hover:text-fg')}>陰線 ({KLINE_TEMPLATES.filter(t => t.type === 'down').length})</button>
          <button onClick={() => setFilter('cross')} className={'px-3.5 py-1.5 rounded-md transition-all ' + (filter === 'cross' ? 'bg-line text-fg-muted border border-fg-muted/20 shadow' : 'text-fg-faint hover:text-fg')}>十字線 ({KLINE_TEMPLATES.filter(t => t.type === 'cross').length})</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map(template => (
          <div key={template.id} className="glass-k-card rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start gap-2 mb-3">
                <div>
                  <span className="text-2xs font-mono text-accent-soft font-black uppercase">型態 #{template.id}</span>
                  <h3 className="text-sm font-black text-fg mt-0.5 flex items-center gap-1.5">
                    {template.name}
                    <span className="text-xs text-fg-muted font-bold">({template.sub})</span>
                  </h3>
                </div>
                <span className={'px-2.5 py-0.5 rounded text-2xs font-black border tracking-wider ' + template.tagColor}>
                  {template.tag}
                </span>
              </div>

              <div className="bg-canvas border-2 border-line-subtle rounded-xl py-4 flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-1 right-2 text-3xs text-fg-dim font-mono select-none">SVG Vector Map</div>
                <KlineDetailIcon
                  type={template.type}
                  high={template.high}
                  open={template.open}
                  close={template.close}
                  low={template.low}
                />
              </div>
            </div>

            <p className="text-xs text-fg font-bold leading-relaxed pt-3.5 border-t border-line-subtle/80 mt-4">
              {template.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
