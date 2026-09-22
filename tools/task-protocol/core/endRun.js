function endRun(result, line, ruleId, aborted) {
  if (result.runBoundary === 'aborted' && !aborted) return;
  result.runBoundary = aborted ? 'aborted' : 'ended';
  result.boundaryEvidence = [{ sourceId: line.sourceId, epoch: line.epoch, sequence: line.sequence, ruleId }];
}
