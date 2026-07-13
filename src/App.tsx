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

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/edit/:code" element={<CodeGate view={Editor} />} />
      <Route path="/host/:code" element={<CodeGate view={HostView} />} />
      <Route path="/stage/:code" element={<CodeGate view={StageView} />} />
      <Route path="/recap/:code" element={<CodeGate view={RecapView} />} />
      <Route path="/:code" element={<CodeGate view={RoomView} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
