# Plan: Build NEXUS premium SaaS frontend

## Goal
Create a production-quality, dark-first NEXUS SaaS frontend with a polished marketing page, complete demo app experience, realistic mock data, and interactive UI patterns that can later connect to a Node.js + Express + MongoDB backend.

## Build approach
- Replace the placeholder home page with a public NEXUS landing page.
- Add a cohesive app shell with sidebar, top bar, mobile navigation, command search, notifications, user menus, modals, drawers, toasts, and responsive behavior.
- Use realistic in-memory mock data and an API service layer so future backend calls can replace mock methods cleanly.
- Keep state and UI interactions fully frontend-driven: filters, tabs, search, task updates, drawers, modals, Kanban movement, settings toggles, and notifications should visibly respond.

## Pages and experiences
- Public: landing page plus authentication and onboarding screens.
- App: overview dashboard, my tasks, projects, project detail with board/tasks/timeline/files/chat/analytics tabs, teams, member profile drawer, messages, calendar, files, notifications, analytics, audit logs, admin, settings, and polished error/empty/loading states.
- Demo mode: Raj Kumar Mishra as Organization Admin for NEXUS Labs with realistic projects, tasks, members, files, messages, calendar events, analytics, and audit logs.

## Component system
- Create reusable UI primitives and product components: buttons, inputs, selects, dropdowns, modals, drawers, tabs, badges, avatars, tooltips, toast system, tables, cards, progress, skeletons, command palette, charts, Kanban board/cards, empty/error states, breadcrumbs, and mobile navigation.
- Use semantic design tokens in the global design system for all colors, surfaces, gradients, shadows, and typography.

## Technical details
- Keep TanStack routing intact and add route files for shareable pages.
- Define app data models in `src/types`, mock data in `src/data`, API-ready methods in `src/services`, reusable hooks/context in `src/hooks` and `src/context`, and UI/page code in `src/components` and `src/pages`.
- Use frontend mock methods for future endpoints including auth, organizations, projects, tasks, messages, notifications, files, analytics, and audit logs.
- Avoid real backend requirements for now; no database or server API is required.
- Add route metadata for every content route.

## Verification
- Check the live preview at desktop and mobile sizes.
- Verify primary interactions: navigation, command palette, dropdowns, modals, tabs, filters, task drawer, Kanban moves, chat composer, calendar event modal, file preview, audit drawer, admin permission toggles, settings toggles, and toasts.
