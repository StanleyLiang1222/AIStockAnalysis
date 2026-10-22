'use client';

import { Icon } from '@/app/components/ui/Icon';

const CARD = 'bg-surface border-2 border-line rounded-xl';

const FACETS = [
  { key: 'valuation', label: '估值', icon: 'pieChart' },
  { key: 'chips', label: '籌碼', icon: 'barChart2' },
  { key: 'fundamentals', label: '基本面', icon: 'activity' },
  { key: 'dividends', label: '股利', icon: 'pieChart' },
  { key: 'technical', label: '技術面', icon: 'trendingUp' },
  { key: 'market', label: '大盤', icon: 'refreshCw' },
];

// 台股配色：偏多紅、偏空綠
const STANCE_CLASS = {
  偏多: 'text-up border-up/40 bg-up/10',
  偏空: 'text-down border-down/40 bg-down/10',
  中性: 'text-fg-muted border-line-strong bg-surface-raised',
  資料不足: 'text-fg-dim border-line-subtle bg-surface-raised',
};

const DISCLAIMER = '本報告由 AI 依公開資料自動產生，僅供參考，不構成投資建議。';

// 台灣時間 MM/DD HH:mm。不用 toLocaleString：伺服器與瀏覽器的 ICU 輸出格式可能不同，會造成 hydration 不一致
const pad = (n) => String(n).padStart(2, '0');
const formatTime = (iso) => {
  const t = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  return `${pad(t.getUTCMonth() + 1)}/${pad(t.getUTCDate())} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
};

function StanceBadge({ stance, large = false }) {
  return (
    <span className={'border rounded font-black whitespace-nowrap ' + (large ? 'px-2.5 py-1 text-sm ' : 'px-2 py-0.5 text-2xs ') + (STANCE_CLASS[stance] ?? STANCE_CLASS.中性)}>
      {stance}
    </span>
  );
}

function GenerateButton({ onClick, className = '' }) {
  return (
    <button onClick={onClick} className={'py-2 px-4 bg-accent text-white text-xs font-bold rounded-lg hover:bg-accent-hover flex items-center justify-center gap-1.5 ' + className}>
      <Icon name="sparkles" className="w-3.5 h-3.5" /> 產生 AI 健檢
    </button>
  );
}

function Pending({ waiting }) {
  return (
    <span className="flex items-center gap-2 text-2xs text-fg-muted font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping flex-shrink-0" />
      {waiting ? '其他使用者正在產生這份報告，請稍候...' : 'AI 分析中，約需 30–60 秒...'}
    </span>
  );
}

const errorText = (errorStatus) => (errorStatus === 503
  ? 'AI 服務或資料庫暫時無法使用，請稍後再試。'
  : 'AI 報告產生失敗，請再試一次。');

function ErrorState({ ai }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-2xs text-fg-muted font-bold text-center">{errorText(ai.errorStatus)}</span>
      {/* 讀取失敗（還不知道資料日期）就重新讀取；產生失敗就重新產生 */}
      <button onClick={ai.dataDate ? ai.generate : ai.reload}
        className="px-3 py-1 bg-surface-raised border border-line-strong rounded text-2xs font-black text-fg hover:border-accent">
        再試一次
      </button>
    </div>
  );
}

/**
 * 總覽最後一格（電腦版）：總評與一句話理由；還沒有報告時直接顯示產生按鈕。
 */
export function AiCard({ ai, onNavigate, className = '' }) {
  const ready = ai.status === 'ready' && ai.report;
  return (
    <div className={CARD + ' p-4 flex flex-col justify-between gap-2 ' + className}>
      <div className="flex justify-between items-center gap-2">
        <span className="text-xs font-black text-fg flex items-center gap-1.5"><Icon name="sparkles" className="w-4 h-4 text-accent" /> AI 多空健檢</span>
        {ready && <StanceBadge stance={ai.report.overall.stance} />}
      </div>
      <div className="bg-surface-raised border-2 border-line-subtle rounded-lg p-2 flex-1 min-h-16 flex items-center justify-center">
        {ai.status === 'loading' && <span className="text-2xs text-fg-muted font-bold">讀取中...</span>}
        {ai.status === 'none' && <GenerateButton onClick={ai.generate} className="w-full" />}
        {ai.status === 'generating' && <Pending waiting={ai.waiting} />}
        {ai.status === 'error' && <ErrorState ai={ai} />}
        {ready && (
          <button onClick={() => onNavigate('ai')} className="w-full text-left">
            <p className="text-2xs text-fg font-bold leading-relaxed line-clamp-2">{ai.report.overall.summary}</p>
            <span className="text-2xs text-accent hover:text-accent-soft font-black">查看完整報告 →</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 「AI 健檢」子分頁：總評、六面分析、風險提示。電腦版與手機版共用。
 */
export function AiReportPanel({ ai }) {
  const report = ai.status === 'ready' ? ai.report : null;

  return (
    <div className="flex flex-col gap-4">
      <div className={CARD + ' p-4 flex flex-col gap-3'}>
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <span className="text-sm font-black text-fg flex items-center gap-1.5">
            <Icon name="sparkles" className="w-5 h-5 text-accent" /> AI 多空健檢
          </span>
          {ai.dataDate && (
            <span className="text-2xs text-fg-muted font-bold font-mono">
              資料日期 {ai.dataDate}{report && ai.createdAt ? `・產生於 ${formatTime(ai.createdAt)}` : ''}
            </span>
          )}
        </div>

        {ai.status === 'loading' && <p className="text-xs text-fg-muted font-bold py-4 text-center">讀取中...</p>}
        {ai.status === 'none' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-xs text-fg-muted font-bold text-center leading-relaxed">
              依估值、籌碼、基本面、股利、技術面、大盤六個面向的真實資料，由 AI 整理多空傾向。<br />
              同一檔股票每個交易日產生一次，所有使用者共用。
            </p>
            <GenerateButton onClick={ai.generate} />
          </div>
        )}
        {ai.status === 'generating' && <div className="py-4 flex justify-center"><Pending waiting={ai.waiting} /></div>}
        {ai.status === 'error' && <div className="py-4"><ErrorState ai={ai} /></div>}

        {report && (
          <div className="flex items-start gap-3 bg-surface-raised border-2 border-line-subtle rounded-lg p-3">
            <StanceBadge stance={report.overall.stance} large />
            <p className="text-xs text-fg font-bold leading-relaxed pt-1">{report.overall.summary}</p>
          </div>
        )}
      </div>

      {report && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {FACETS.map(({ key, label, icon }) => {
              const facet = report.facets[key];
              return (
                <div key={key} className={CARD + ' p-4 flex flex-col gap-3'}>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-black text-fg flex items-center gap-1.5">
                      <Icon name={icon} className="w-4 h-4 text-accent" /> {label}
                    </span>
                    <StanceBadge stance={facet.stance} />
                  </div>
                  <ul className="space-y-1.5">
                    {facet.points.map((point, i) => (
                      <li key={i} className="text-xs text-fg-muted font-bold leading-relaxed flex gap-2">
                        <span className="text-fg-dim">・</span><span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {report.risks.length > 0 && (
            <div className={CARD + ' p-4 flex flex-col gap-3 border-warn/40'}>
              <span className="text-xs font-black text-warn flex items-center gap-1.5">
                <Icon name="activity" className="w-4 h-4" /> 風險與矛盾訊號
              </span>
              <ul className="space-y-1.5">
                {report.risks.map((risk, i) => (
                  <li key={i} className="text-xs text-fg-muted font-bold leading-relaxed flex gap-2">
                    <span className="text-warn">・</span><span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <p className="text-2xs text-fg-dim font-bold text-center">{DISCLAIMER}</p>
    </div>
  );
}
