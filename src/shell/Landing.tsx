import { Navigate, useLocation } from 'react-router';
import { APP_ROUTE, LANDING_ROUTE } from './routes';

/**
 * The landing route of a product (shell 0.13.0, Felipe 2026-10-13: "the shell and the apps must land at the Introduction,
 * executive view"). Mount it on the root path and on the catch-all path:
 *
 *     <Route path="/" element={<Landing />} />
 *     <Route path="/app" element={<App />} />
 *     <Route path="*" element={<Landing />} />
 *
 * The root and any unknown entry open the Introduction, whose executive view is its first and default view. An old link
 * to the App, which was the root (`/?case=B2`, with a query string or a hash), is forwarded to the App route with the query
 * string and the hash kept, so a link in a paper or a bookmark still reaches its case.
 */
export function Landing() {
  const { pathname, search, hash } = useLocation();
  const oldAppLink = pathname === '/' && (search !== '' || hash !== '');
  return <Navigate to={`${oldAppLink ? APP_ROUTE : LANDING_ROUTE}${search}${hash}`} replace />;
}
