import type { Briefing } from '@/types/briefing';

export function Encerramento({ encerramento }: { encerramento: Briefing['encerramento'] }) {
  return (
    <footer className="encerramento" id="encerramento">
      <div className="wrap">
        <div className="eyebrow">Para fechar o dia</div>
        <div className="enc-grid">
          <div>
            <div className="enc-block-label">Ideia principal</div>
            <div className="enc-block-text">{encerramento.ideiaPrincipal}</div>
          </div>
          <div>
            <div className="enc-block-label">Conceito para levar</div>
            <div className="enc-block-text">{encerramento.conceito}</div>
          </div>
          <div>
            <div className="enc-block-label">Reflexão prática</div>
            <div className="enc-block-text">{encerramento.reflexao}</div>
          </div>
        </div>
        <div className="enc-signoff">{encerramento.assinatura}</div>
      </div>
    </footer>
  );
}
