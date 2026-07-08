import { useEffect } from 'react';
import { useStore } from './store';
import { applyTheme } from './lib/themes';
import { Chrome } from './components/Chrome';
import { Terminal } from './components/Terminal';

export default function App() {
  const theme = useStore((s) => s.theme);
  const term = useStore((s) => s.term);
  const opacity = useStore((s) => s.opacity);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <>
      <div id="app-bg" />
      <div className="fixed inset-0">
        <Chrome term={term} opacity={opacity}>
          <Terminal />
        </Chrome>
      </div>
    </>
  );
}
