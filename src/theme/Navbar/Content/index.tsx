import React, {type ReactNode} from 'react';
import {
  useThemeConfig,
  ErrorCauseBoundary,
} from '@docusaurus/theme-common';
import {
  splitNavbarItems,
  useNavbarMobileSidebar,
} from '@docusaurus/theme-common/internal';
import NavbarItem, {type Props as NavbarItemConfig} from '@theme/NavbarItem';
import NavbarMobileSidebarToggle from '@theme/Navbar/MobileSidebar/Toggle';
import NavbarLogo from '@theme/Navbar/Logo';
import NavbarColorModeToggle from '@theme/Navbar/ColorModeToggle';

function useNavbarItems() {
  return useThemeConfig().navbar.items as NavbarItemConfig[];
}

function NavbarItems({items}: {items: NavbarItemConfig[]}): ReactNode {
  return (
    <>
      {items.map((item, index) => (
        <ErrorCauseBoundary
          key={index}
          onError={(error) => new Error(
            `A Telemark navbar item failed to render: ${JSON.stringify(item)}`,
            {cause: error},
          )}
        >
          <NavbarItem {...item} />
        </ErrorCauseBoundary>
      ))}
    </>
  );
}

export default function NavbarContent(): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();
  const [centerItems, rightItems] = splitNavbarItems(useNavbarItems());

  return (
    <div className="navbar__inner telemark-navbar-inner">
      <div className="navbar__items telemark-navbar-brand">
        {!mobileSidebar.disabled && <NavbarMobileSidebarToggle />}
        <NavbarLogo />
      </div>

      <div className="navbar__items telemark-navbar-center">
        <NavbarItems items={centerItems} />
      </div>

      <div className="navbar__items navbar__items--right telemark-navbar-account">
        {/* This navbar is swizzled, so nothing renders the theme switch unless
            it is placed here. Enabling colorMode in the config was not enough:
            the site shipped a light theme with no way to reach it. */}
        <NavbarColorModeToggle className="telemark-navbar-theme" />
        <NavbarItems items={rightItems} />
      </div>
    </div>
  );
}
