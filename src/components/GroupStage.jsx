import MatchCard from './MatchCard';

export default function GroupStage({ groups, groupWinners, onPickWinner }) {
  return (
    <div className="group-stage">
      <h2 className="section-title">Group Stage</h2>
      <p className="section-subtitle">Pick the top 2 teams from each group to advance</p>
      <div className="groups-grid">
        {Object.entries(groups).map(([letter, group]) => {
          const picks = groupWinners[letter] || [];
          return (
            <div key={letter} className="group-card">
              <h3 className="group-card__title">{group.name}</h3>
              <div className="group-card__teams">
                {group.teams.map((team) => {
                  const rank = picks.indexOf(team);
                  return (
                    <button
                      key={team}
                      className={`group-team-btn${rank === 0 ? ' group-team-btn--first' : rank === 1 ? ' group-team-btn--second' : ''}`}
                      onClick={() => onPickWinner(letter, team)}
                    >
                      {rank === 0 && <span className="rank-badge rank-badge--1">1st</span>}
                      {rank === 1 && <span className="rank-badge rank-badge--2">2nd</span>}
                      <span className="group-team-btn__name">{team}</span>
                    </button>
                  );
                })}
              </div>
              {picks.length < 2 && (
                <p className="group-card__hint">Pick {2 - picks.length} more to advance</p>
              )}
              {picks.length === 2 && (
                <p className="group-card__hint group-card__hint--done">
                  ✓ {picks[0]} (1st) &amp; {picks[1]} (2nd)
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
