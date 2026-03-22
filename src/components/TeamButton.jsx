export default function TeamButton({ team, isSelected, onClick, disabled }) {
  if (!team) {
    return (
      <div className={`team-button team-button--empty${disabled ? ' team-button--disabled' : ''}`}>
        <span className="team-button__name">TBD</span>
      </div>
    );
  }
  return (
    <button
      className={`team-button${isSelected ? ' team-button--selected' : ''}${disabled ? ' team-button--disabled' : ''}`}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
    >
      <span className="team-button__name">{team}</span>
      {isSelected && <span className="team-button__check">✓</span>}
    </button>
  );
}
