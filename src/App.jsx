import { useState, useCallback } from 'react';
import { groups } from './data/teams';
import GroupStage from './components/GroupStage';
import KnockoutBracket from './components/KnockoutBracket';
import './App.css';

function buildR16Matches(groupWinners) {
  const g = (letter, rank) => (groupWinners[letter] || [])[rank] || null;
  return [
    { id: 'r16_1', team1: g('A', 0), team2: g('B', 1) },
    { id: 'r16_2', team1: g('C', 0), team2: g('D', 1) },
    { id: 'r16_3', team1: g('E', 0), team2: g('F', 1) },
    { id: 'r16_4', team1: g('G', 0), team2: g('H', 1) },
    { id: 'r16_5', team1: g('B', 0), team2: g('A', 1) },
    { id: 'r16_6', team1: g('D', 0), team2: g('C', 1) },
    { id: 'r16_7', team1: g('F', 0), team2: g('E', 1) },
    { id: 'r16_8', team1: g('H', 0), team2: g('G', 1) },
  ];
}

function buildQFMatches(r16Winners) {
  const w = (id) => r16Winners[id] || null;
  return [
    { id: 'qf_1', team1: w('r16_1'), team2: w('r16_2') },
    { id: 'qf_2', team1: w('r16_3'), team2: w('r16_4') },
    { id: 'qf_3', team1: w('r16_5'), team2: w('r16_6') },
    { id: 'qf_4', team1: w('r16_7'), team2: w('r16_8') },
  ];
}

function buildSFMatches(qfWinners) {
  const w = (id) => qfWinners[id] || null;
  return [
    { id: 'sf_1', team1: w('qf_1'), team2: w('qf_2') },
    { id: 'sf_2', team1: w('qf_3'), team2: w('qf_4') },
  ];
}

function buildFinal(sfWinners) {
  return { team1: sfWinners['sf_1'] || null, team2: sfWinners['sf_2'] || null };
}

function buildThirdPlace(sfWinners, sfMatches) {
  const loser = (id, winner, match) => {
    if (!winner || !match.team1 || !match.team2) return null;
    return winner === match.team1 ? match.team2 : match.team1;
  };
  const sf1Loser = loser('sf_1', sfWinners['sf_1'], sfMatches[0]);
  const sf2Loser = loser('sf_2', sfWinners['sf_2'], sfMatches[1]);
  return { team1: sf1Loser, team2: sf2Loser };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('groups');
  const [groupWinners, setGroupWinners] = useState({});
  const [r16Winners, setR16Winners] = useState({});
  const [qfWinners, setQFWinners] = useState({});
  const [sfWinners, setSFWinners] = useState({});
  const [finalWinner, setFinalWinner] = useState(null);
  const [thirdPlaceWinner, setThirdPlaceWinner] = useState(null);

  const handleGroupPick = useCallback((letter, team) => {
    setGroupWinners((prev) => {
      const current = prev[letter] || [];
      const idx = current.indexOf(team);
      let next;
      if (idx === 0) {
        next = current.slice(1);
      } else if (idx === 1) {
        next = [current[0]];
      } else if (current.length < 2) {
        next = [...current, team];
      } else {
        next = [current[0], team];
      }
      setR16Winners({});
      setQFWinners({});
      setSFWinners({});
      setFinalWinner(null);
      setThirdPlaceWinner(null);
      return { ...prev, [letter]: next };
    });
  }, []);

  const handleR16Pick = useCallback((matchId, team) => {
    setR16Winners((prev) => {
      const next = { ...prev, [matchId]: prev[matchId] === team ? undefined : team };
      setQFWinners({});
      setSFWinners({});
      setFinalWinner(null);
      setThirdPlaceWinner(null);
      return next;
    });
  }, []);

  const handleQFPick = useCallback((matchId, team) => {
    setQFWinners((prev) => {
      const next = { ...prev, [matchId]: prev[matchId] === team ? undefined : team };
      setSFWinners({});
      setFinalWinner(null);
      setThirdPlaceWinner(null);
      return next;
    });
  }, []);

  const handleSFPick = useCallback((matchId, team) => {
    setSFWinners((prev) => {
      const next = { ...prev, [matchId]: prev[matchId] === team ? undefined : team };
      setFinalWinner(null);
      setThirdPlaceWinner(null);
      return next;
    });
  }, []);

  const handleFinalPick = useCallback((team) => {
    setFinalWinner((prev) => (prev === team ? null : team));
  }, []);

  const handleThirdPlacePick = useCallback((team) => {
    setThirdPlaceWinner((prev) => (prev === team ? null : team));
  }, []);

  const handleReset = useCallback(() => {
    setGroupWinners({});
    setR16Winners({});
    setQFWinners({});
    setSFWinners({});
    setFinalWinner(null);
    setThirdPlaceWinner(null);
  }, []);

  const r16Matches = buildR16Matches(groupWinners);
  const qfMatches = buildQFMatches(r16Winners);
  const sfMatches = buildSFMatches(qfWinners);
  const finalMatch = buildFinal(sfWinners);
  const thirdPlaceMatch = buildThirdPlace(sfWinners, sfMatches);

  const groupsComplete = Object.keys(groups).every(
    (letter) => (groupWinners[letter] || []).length === 2
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__title-row">
            <span className="app-header__icon">&#9917;</span>
            <h1 className="app-header__title">World Cup Bracket</h1>
            <span className="app-header__icon">&#127942;</span>
          </div>
          <p className="app-header__subtitle">Make your World Cup picks!</p>
        </div>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-tab${activeTab === 'groups' ? ' nav-tab--active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Group Stage
        </button>
        <button
          className={`nav-tab${activeTab === 'knockout' ? ' nav-tab--active' : ''}${!groupsComplete ? ' nav-tab--locked' : ''}`}
          onClick={() => groupsComplete && setActiveTab('knockout')}
          title={!groupsComplete ? 'Complete the group stage first' : ''}
        >
          Knockout Rounds {!groupsComplete && String.fromCodePoint(0x1F512)}
        </button>
        <button className="nav-tab nav-tab--reset" onClick={handleReset}>
          Reset All
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'groups' && (
          <>
            <GroupStage
              groups={groups}
              groupWinners={groupWinners}
              onPickWinner={handleGroupPick}
            />
            {groupsComplete && (
              <div className="advance-prompt">
                <p>All groups complete! &#127881;</p>
                <button className="btn-primary" onClick={() => setActiveTab('knockout')}>
                  Continue to Knockout Rounds &rarr;
                </button>
              </div>
            )}
          </>
        )}
        {activeTab === 'knockout' && (
          <KnockoutBracket
            roundOf16={r16Matches}
            quarterFinals={qfMatches}
            semiFinals={sfMatches}
            final={finalMatch}
            thirdPlace={thirdPlaceMatch}
            r16Winners={r16Winners}
            qfWinners={qfWinners}
            sfWinners={sfWinners}
            finalWinner={finalWinner}
            thirdPlaceWinner={thirdPlaceWinner}
            onPickR16={handleR16Pick}
            onPickQF={handleQFPick}
            onPickSF={handleSFPick}
            onPickFinal={handleFinalPick}
            onPickThirdPlace={handleThirdPlacePick}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>World Cup Bracket Picks &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
