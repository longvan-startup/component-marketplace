/**
 * Navigation targets shared by the desktop NavBar and the mobile menu. Only
 * routes that exist, or land in the very next step (login/register — issue
 * #135 scope note), are listed; "Cộng đồng" from Figma waits for its route.
 */
export const NAV_LINKS = [
  { href: '/components', label: 'Danh mục' },
  { href: '/pricing', label: 'Bảng giá' },
] as const

export const NAV_ACTIONS = {
  login: { href: '/login', label: 'Đăng nhập' },
  register: { href: '/register', label: 'Đăng ký' },
} as const

/* Planned sections: shown in the navbar, not followable until their route exists. */
export const NAV_SOON = [{ label: 'Cộng đồng' }] as const
