import React, {useEffect, type ReactNode} from 'react';
import {useHistory, useLocation} from '@docusaurus/router';
import {useAuth} from '@site/src/telemark/useAuth';
import {useLearnerProfile} from '@site/src/telemark/useLearnerProfile';
import {useBasePath} from '@site/src/telemark/useBasePath';

const EXEMPT_ROUTES = ['/admin', '/login', '/personalize'];
const CURRICULUM_ROUTES = ['/docs', '/blocks', '/mechanical', '/simulator', '/dashboard'];

function withoutTrailingSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function personalizationBypassKey(uid: string): string {
  return `telemark:profile-bypass:${uid}`;
}

export function isCurriculumRoute(pathname: string, baseRoot: string): boolean {
  const path = withoutTrailingSlash(pathname);
  const root = withoutTrailingSlash(baseRoot);
  const relativePath = root !== '/' && (path === root || path.startsWith(`${root}/`))
    ? path.slice(root.length) || '/'
    : path;
  return CURRICULUM_ROUTES.some((route) =>
    relativePath === route || relativePath.startsWith(`${route}/`),
  );
}

export default function PersonalizationGate({children}: {children: ReactNode}): React.JSX.Element {
  const {user, loading: authLoading} = useAuth();
  const {status} = useLearnerProfile();
  const location = useLocation();
  const history = useHistory();
  const basePath = useBasePath();

  useEffect(() => {
    if (authLoading || !user || status !== 'absent') return;
    if (withoutTrailingSlash(location.pathname) === withoutTrailingSlash(basePath('/'))) return;
    if (EXEMPT_ROUTES.some((route) => location.pathname.endsWith(route))) return;
    if (!isCurriculumRoute(location.pathname, basePath('/'))) return;
    if (window.sessionStorage.getItem(personalizationBypassKey(user.uid)) === '1') return;
    const next = `${location.pathname}${location.search}${location.hash}`;
    history.replace(basePath(`/personalize?next=${encodeURIComponent(next)}`));
  }, [authLoading, user, status, location, history, basePath]);

  return <>{children}</>;
}
