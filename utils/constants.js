const ROUNDS = ['r32', 'r16', 'qf', 'sf', 'final'];

const ROUND_LABELS = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-Finals',
  sf: 'Semi-Finals',
  final: 'Final'
};

const KNOCKOUT_POINTS = { r32: 2, r16: 4, qf: 8, sf: 16, final: 32 };

module.exports = { ROUNDS, ROUND_LABELS, KNOCKOUT_POINTS };
