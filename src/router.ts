import {useCallback, useEffect, useState} from 'react';

export type Route = 'body' | 'vitals' | 'routine';
const ROUTES: Route[] = ['body', 'vitals', 'routine'];

const parse = (): Route => {
  const r = location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(r) ? r : 'body';
};

/** Minimal hash router: #/body, #/vitals, #/routine. Works on any static host. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const onHash = () => setRoute(parse());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);
  const go = useCallback((r: Route) => { location.hash = `/${r}`; }, []);
  return [route, go] as const;
}
