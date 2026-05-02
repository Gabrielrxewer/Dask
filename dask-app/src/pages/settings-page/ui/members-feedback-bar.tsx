interface MembersFeedbackBarProps {
  feedback: string;
  error: string;
}

export function MembersFeedbackBar({ feedback, error }: MembersFeedbackBarProps) {
  if (!feedback && !error) {
    return null;
  }

  return (
    <div className="ms-feedback-bar">
      {feedback && <span className="ms-feedback-bar__ok">{feedback}</span>}
      {error && <span className="ms-feedback-bar__err">{error}</span>}
    </div>
  );
}
