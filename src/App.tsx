import { HermesBodyDashboard } from './dashboard/HermesBodyDashboard';
import { CharacterSimulator } from './simulator/CharacterSimulator';

export default function App(): JSX.Element {
  const isSimulator = new URLSearchParams(window.location.search).get('view') === 'simulator';
  return isSimulator ? <CharacterSimulator /> : <HermesBodyDashboard />;
}
