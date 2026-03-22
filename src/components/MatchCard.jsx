import TeamButton from './TeamButton';

export default function MatchCard({ team1, team2, winner, onPickWinner, label }) {
  return (
    <div className="match-card">
      {label && <div className="match-card__label">{label}</div>}
      <div className="match-card__teams">
        <TeamButton
          team={team1}
          isSelected={winner === team1}
          onClick={() => team1 && onPickWinner(team1)}
          disabled={!team1 || !team2}
        />
        <div className="match-card__vs">vs</div>
        <TeamButton
          team={team2}
          isSelected={winner === team2}
          onClick={() => team2 && onPickWinner(team2)}
          disabled={!team1 || !team2}
        />
      </div>
    </div>
  );
}
