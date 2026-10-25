// SPDX-License-Identifier: GPL-3.0-or-later
const appName = import.meta.env.VITE_APP_NAME ?? 'SaviaTech';

// Función principal de la app
export function App() {
  return (
    <main>
      <h1>{appName}</h1>
    </main>
  );
}
