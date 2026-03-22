import MatchCard from './MatchCard';

function RoundColumn({ title, matches, winners, onPick }) {
  return (
    <div className="round-column">
      <h3 className="round-column__title">{title}</h3>
      <div className="round-column__matches">
        {matches.map((match, idx) => (
          <MatchCard
            key={match.id || idx}
            team1={match.team1}
            team2={match.team2}
            winner={winners[match.id || idx]}
            onPickWinner={(team) => onPick(match.id || idx, team)}
          />
        ))}
      </div>
    </div>
  );
}

export default function KnockoutBracket({
  roundOf16,
  quarterFinals,
  semiFinals,
  final,
  thirdPlace,
  r16Winners,
  qfWinners,
  sfWinners,
  finalWinner,
  thirdPlaceWinner,
  onPickR16,
  onPickQF,
  onPickSF,
  onPickFinal,
  onPickThirdPlace,
}) {
  return (
    <div className="knockout-bracket">
      <h2 className="section-title">Knockout Rounds</h2>
      <p className="section-subtitle">Click a team to advance them to the next round</p>
      <div className="bracket-grid">
        <RoundColumn
          title="Round of 16"
          matches={roundOf16}
          winners={r16Winners}
          onPick={onPickR16}
        />
        <RoundColumn
          title="Quarter Finals"
          matches={quarterFinals}
          winners={qfWinners}
          onPick={onPickQF}
        />
        <RoundColumn
          title="Semi Finals"
          matches={semiFinals}
          winners={sfWinners}
          onPick={onPickSF}
        />
        <div className="round-column round-column--finals">
          <h3 className="round-column__title">Final</h3>
          <div className="round-column__matches">
            <MatchCard
              team1={final.team1}
              team2={final.team2}
              winner={finalWinner}
              onPickWinner={(team) => onPickFinal(team)}
            />
          </div>
          {finalWinner && (
            <div className="champion-banner">
              <div className="champion-banner__trophy">🏆</div>
              <div className="champion-banner__label">Champion</div>
              <div className="champion-banner__team">{finalWinner}</div>
            </div>
          )}
          <h3 className="round-column__title round-column__title--third">3rd Place</h3>
          <div className="round-column__matches">
            <MatchCard
              team1={thirdPlace.team1}
              team2={thirdPlace.team2}
              winner={thirdPlaceWinner}
              onPickWinner={(team) => onPickThirdPlace(team)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
