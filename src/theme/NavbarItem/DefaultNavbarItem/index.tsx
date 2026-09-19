import React, {type ReactNode} from 'react';
import DefaultNavbarItemMobile from '@theme/NavbarItem/DefaultNavbarItem/Mobile';
import DefaultNavbarItemDesktop from '@theme/NavbarItem/DefaultNavbarItem/Desktop';
import type {Props} from '@theme/NavbarItem/DefaultNavbarItem';
import {useAuth} from '@site/src/telemark/useAuth';

export default function DefaultNavbarItem({
  mobile = false,
  position,
  ...props
}: Props): ReactNode {
  const isAuthItem = props.className?.split(/\s+/).includes('navbar-auth-link');
  const {user} = useAuth();
  const Comp = mobile ? DefaultNavbarItemMobile : DefaultNavbarItemDesktop;

  // This slot was pinned to "Dashboard" for everyone, so a visitor who had
  // never signed in was offered their dashboard and no way to sign in at all.
  // Signed out is also what the server renders, which is the right default for
  // a static page: the link only becomes the dashboard once there is an
  // account behind it.
  const resolvedProps = isAuthItem
    ? {
        ...props,
        to: user ? '/dashboard' : '/login',
        label: user ? 'Dashboard' : 'Sign in',
      }
    : props;

  return (
    <Comp
      {...resolvedProps}
      activeClassName={
        resolvedProps.activeClassName
        ?? (mobile ? 'menu__link--active' : 'navbar__link--active')
      }
    />
  );
}
