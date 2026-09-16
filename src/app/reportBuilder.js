function validateFingerprint(context) {
  const buildFingerprint = context?.build?.fingerprint;
  if (!buildFingerprint || buildFingerprint !== context?.checkpoint?.buildFingerprint) {
    throw new Error('report build fingerprint must match checkpoint');
  }
}

function structuredReport(context) {
  validateFingerprint(context);
  return {
    build: context.build,
    checkpoint: context.checkpoint,
    configuration: context.configuration ?? {},
    exportedAt: context.exportedAt ?? new Date().toISOString(),
    journal: context.journal ?? [],
    ledger: context.ledger ?? [],
    marks: context.marks ?? [],
    warnings: context.warnings ?? []
  };
}

export function buildJsonReport(context) {
  return JSON.stringify(structuredReport(context), null, 2);
}

export function buildTextReport(context) {
  const report = structuredReport(context);
  const lines = [
    'MARKET STALL LAB EVIDENCE',
    `Exported at: ${report.exportedAt}`,
    `Build fingerprint: ${report.build.fingerprint}`,
    `Game minute: ${report.checkpoint.state?.gameMinute ?? 'unknown'}`,
    '',
    `Configuration: ${JSON.stringify(report.configuration)}`,
    `Warnings: ${report.warnings.length}`,
    `Marks: ${report.marks.length}`,
    '',
    'JOURNAL'
  ];
  for (const event of report.journal) lines.push(JSON.stringify(event));
  lines.push('', 'LEDGER');
  for (const entry of report.ledger) lines.push(JSON.stringify(entry));
  return `${lines.join('\n')}\n`;
}
