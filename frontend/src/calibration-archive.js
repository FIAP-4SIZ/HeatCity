// Ephemeral, complete history for one preparation flow. Never persists biometric data.
export class CalibrationArchive {
  records = [];
  append(report) {
    this.records.push(
      structuredClone({
        ...report,
        status: report.status || (report.quality?.approved ? 'approved' : 'rejected'),
        archived_at: new Date().toISOString(),
        attempt_number: this.records.length + 1,
      }),
    );
  }
  snapshot() {
    return {
      version: 1,
      record_type: 'official_calibration_history',
      generated_at: new Date().toISOString(),
      attempts_total: this.records.length,
      page_diagnostic: { calibrations: structuredClone(this.records) },
      privacy:
        'Histórico temporário desta preparação: códigos, características oculares e telemetria; sem fotos, vídeo ou dados pessoais solicitados. Não contém autorização de sessão.',
    };
  }
}
export function downloadCalibrationArchive(archive) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(archive.snapshot())], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'heatcity-calibracoes-teste-oficial.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
