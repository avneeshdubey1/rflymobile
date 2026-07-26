function isEligible(lmv) {
  return Boolean(lmv) && lmv.status === 'AVAILABLE';
}

function ineligibleReason(lmv) {
  if (!lmv) return 'LMV not found';
  if (lmv.status === 'MAINTENANCE') return 'LMV is in maintenance';
  if (lmv.status === 'OUT_OF_SERVICE') return 'LMV is out of service';
  if (lmv.status === 'ASSIGNED') return 'LMV is already assigned';
  if (lmv.status !== 'AVAILABLE') return 'LMV is not available';
  return null;
}

module.exports = { isEligible, ineligibleReason };
