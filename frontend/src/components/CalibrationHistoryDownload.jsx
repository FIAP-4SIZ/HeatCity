import React from 'react';
import { downloadCalibrationArchive } from '../calibration-archive.js';
export default function CalibrationHistoryDownload({ archive }) {
  if (!archive.records.length) return null;
  return (
    <div className="calibration-history-download">
      <button className="secondary" onClick={() => downloadCalibrationArchive(archive)}>
        Baixar todas as calibrações deste teste ({archive.records.length})
      </button>
      <p className="small">
        Inclui tentativas aprovadas, reprovadas e interrompidas desta preparação, sinais por alvo e
        telemetria, sem descartar as mais antigas. Baixe antes de sair da etapa ou recarregar a
        página. Sem imagens de webcam.
      </p>
    </div>
  );
}
