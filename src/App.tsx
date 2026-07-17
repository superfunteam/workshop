import { Component, type ReactNode } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import Home from './views/Home.tsx';
import Editor from './views/Editor.tsx';
import HostView from './views/Host.tsx';
import StageView from './views/Stage.tsx';
import RecapView from './views/Recap.tsx';
import RoomView from './views/Room.tsx';
import { normalizeCode } from '../shared/codes.ts';

function CodeGate({ view: View }: { view: (props: { code: string }) => React.ReactElement }) {
  const { code: raw } = useParams();
  const code = normalizeCode(raw ?? '');
  if (code.length < 4 || code.length > 8) return <Navigate to="/" replace />;
  return <View code={code} />;
}

// The last line of defense: any unexpected render error anywhere shows a calm
// recovery card instead of a white screen. Every bit of session state lives on
// the server, so a reload always lands right back where the room is.
class ErrorShield extends Component<{ children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[workshop] render crash', error);
  }
  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-6xl">🫣</div>
        <h1 className="display-type text-3xl">Well, that wasn’t the plan</h1>
        <p className="max-w-md font-semibold text-ink-soft">
          Everything is saved on the server — reload and you’ll be right back in the room.
        </p>
        <button
          type="button"
          className="btn-pop bg-ink text-white hover:bg-ink/90"
          onClick={() => location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }
}

export default function App() {
  return (
    <ErrorShield>
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/edit/:code" element={<CodeGate view={Editor} />} />
      <Route path="/host/:code" element={<CodeGate view={HostView} />} />
      <Route path="/stage/:code" element={<CodeGate view={StageView} />} />
      <Route path="/recap/:code" element={<CodeGate view={RecapView} />} />
      <Route path="/:code" element={<CodeGate view={RoomView} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorShield>
  );
}
