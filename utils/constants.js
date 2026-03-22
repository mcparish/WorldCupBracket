const ROUNDS = ['r32', 'r16', 'qf', 'sf', 'final'];

const ROUND_LABELS = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-Finals',
  sf: 'Semi-Finals',
  final: 'Final'
};

const KNOCKOUT_POINTS = { r32: 2, r16: 4, qf: 8, sf: 16, final: 32 };

/** Maximum score value accepted in match score input fields. */
const MAX_SCORE = 20;

/**
 * Returns the match outcome from the perspective of the home team.
 * @param {number} home
 * @param {number} away
 * @returns {'home'|'away'|'draw'}
 */
function getOutcome(home, away) {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'draw';
}

/**
 * Calculates the points earned for a single group-stage pick.
 * @param {number} homeActual
 * @param {number} awayActual
 * @param {number} homePick
 * @param {number} awayPick
 * @returns {0|1|2}
 */
function calcGroupPickPoints(homeActual, awayActual, homePick, awayPick) {
  if (getOutcome(homePick, awayPick) !== getOutcome(homeActual, awayActual)) return 0;
  if (homePick === homeActual && awayPick === awayActual) return 2;
  return 1;
}

module.exports = { ROUNDS, ROUND_LABELS, KNOCKOUT_POINTS, MAX_SCORE, getOutcome, calcGroupPickPoints };
