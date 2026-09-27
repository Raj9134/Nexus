# Nexus Workspace

Build a premium, production-quality SaaS web application called NEXUS — an enterprise collaboration, project management, workflow, communication, and team productivity platform.

The frontend should look like a product that could realistically compete with modern products such as Linear, Notion, Slack, Jira, and ClickUp, but DO NOT copy any of their branding or exact UI. Create an original, highly polished visual identity.

IMPORTANT:

This is primarily a FRONTEND project.

Build a complete, highly interactive frontend with realistic mock data.

Structure the frontend so it can later connect cleanly to a Node.js + Express + MongoDB backend.

Use reusable components and clean architecture.

Every major button, navigation item, dropdown, modal, tab, filter, search field, and interaction should work in the frontend.

Do not create a static mockup.

Use realistic data instead of lorem ipsum.

Make the application feel like a real enterprise product.

Prioritize visual quality, UX, responsiveness, accessibility, and micro-interactions.

==================================================

BRAND & VISUAL IDENTITY
==================================================

Product name:

NEXUS

Tagline:

"One workspace. Every team. Complete visibility."

Brand personality:

Premium

Modern

Intelligent

Enterprise-grade

Technical

Minimal

Confident

Fast

Visual direction:

Create a sophisticated dark-first SaaS interface.

Primary theme:

Deep near-black background

Charcoal/slate surfaces

Subtle borders

High contrast typography

Carefully controlled accent colors

Soft gradients

Glass-like surfaces only where appropriate

Avoid excessive glassmorphism

Avoid childish colors

Avoid excessive rounded cards

Avoid generic Bootstrap-looking UI

Use a modern typography system with excellent hierarchy.

The interface should feel:
"Linear + modern enterprise SaaS + developer tooling"

Use:

subtle shadows

soft glow effects

smooth hover transitions

animated state changes

tasteful gradients

skeleton loading states

empty states

tooltips

keyboard-friendly interactions

Do NOT make every section colorful.

Use accent colors mainly for:

primary actions

status indicators

charts

notifications

important highlights

================================================== 2. RESPONSIVE DESIGN

The application MUST work beautifully on:

Desktop

Laptop

Tablet

Mobile

Desktop:

Persistent sidebar

Large content area

Optional right-side contextual panels

Tablet:

Collapsible sidebar

Responsive grids

Mobile:

Bottom navigation or compact navigation

Drawer-based sidebar

Stacked cards

Horizontally scrollable Kanban columns

Mobile-friendly modals

Touch-friendly controls

No horizontal page overflow.

================================================== 3. APPLICATION SHELL

Create a professional application shell.

LEFT SIDEBAR:

Top:

NEXUS logo
Organization selector

Example:

NEXUS
Raj's Organization ▼

Navigation:

Overview
Inbox
My Tasks
Projects
Teams
Messages
Calendar
Files
Analytics

Workspace section:

Projects

Create Project

Example projects:

Payment Platform

Mobile Banking

Internal Tools

Website Redesign

Bottom:

Help & Support
Settings
User Profile

Profile:

Raj Kumar Mishra
Backend Developer

Avatar

Sidebar behavior:

Expand/collapse

Smooth animation

Tooltips when collapsed

Active navigation indicator

Organization switcher dropdown

================================================== 4. TOP NAVBAR

Top navigation should contain:

Global search:

"Search projects, tasks, people..."

Keyboard shortcut indicator:

⌘ K

Right side:

Create button
Notifications
Messages
Theme toggle
User avatar

Create button opens:

Create Task
Create Project
Invite Member
Create Team

Notifications should have:

unread indicator

notification count

timestamps

notification categories

================================================== 5. GLOBAL SEARCH

Create a powerful command-palette-style search experience.

When clicking search or pressing:

Ctrl/Cmd + K

Open a modal.

Search across:

Tasks
Projects
People
Teams
Messages
Files

Include:

Recent searches
Suggested commands
Keyboard shortcuts

Example:

Search:
"authentication"

Results:

Tasks
"Implement JWT authentication"

Projects
"Backend Authentication"

People
"Raj Kumar Mishra"

Messages
"Authentication API discussion"

Use highlighted search terms.

================================================== 6. OVERVIEW DASHBOARD

Create a visually impressive executive dashboard.

Header:

Good evening, Raj 👋

"Here's what's happening across your workspace."

Top-right:

This week ▼

Create

STAT CARDS:

Total Projects
12

Active Tasks
48

Completed Tasks
127

Overdue
9

Each card should include:

icon

number

small trend indicator

comparison with previous period

Example:

+12.5%
vs last month

Do not overuse colors.

================================================== 7. DASHBOARD ANALYTICS

Create a beautiful analytics section.

Chart 1:

Project Progress

Large area/line chart.

Chart 2:

Tasks by Status

Donut chart:

Backlog
Todo
In Progress
Review
Done

Chart 3:

Team Workload

Horizontal bar chart.

Chart 4:

Weekly Productivity

Mon
Tue
Wed
Thu
Fri
Sat
Sun

Include hover tooltips.

Use realistic data.

Charts should look premium and clean.

================================================== 8. RECENT ACTIVITY

Create a timeline:

Raj moved "Payment API" to In Progress

Amit completed "Database migration"

Priya commented on "Authentication"

Rahul joined Engineering

Admin changed Raj's role

Each activity should contain:

avatar

action

resource

timestamp

================================================== 9. MY TASKS

Create a dedicated task management page.

Header:

My Tasks

Tabs:

All
Today
Upcoming
Overdue
Completed

Filters:

Project
Priority
Status
Assignee
Due Date

Task list/table:

Checkbox
Task
Project
Priority
Status
Assignee
Due Date

Example:

Implement JWT authentication
Backend
High
In Progress
Raj
Sep 24

Add payment validation
Payments
Medium
Todo
Raj
Sep 25

Create responsive dashboard
Frontend
High
Review
Amit
Sep 26

Tasks should be interactive.

Clicking a task opens a detailed side panel.

================================================== 10. TASK DETAIL PANEL

Create a beautiful task detail drawer.

Header:

Task ID
Status
Priority
More menu

Content:

Title

Description

Project

Assignee

Reporter

Due date

Labels

Attachments

Checklist

Comments

Activity

Example:

TASK-124

Implement JWT Authentication

Description:
Implement secure authentication using access and refresh tokens.

Checklist:

☑ Create User model
☑ Password hashing
☐ Access token
☐ Refresh token
☐ Authentication middleware

Comments:

Raj Kumar Mishra
"Refresh token flow is ready."

Priya Sharma
"Let's add token rotation."

Activity timeline.

Actions:

Edit
Assign
Change Status
Delete

================================================== 11. PROJECTS PAGE

Create a project management page.

Header:

Projects

Search projects

Filter:

All
Active
Archived

Project cards:

Payment Platform

Progress:
72%

12 members

24 tasks

8 completed

Due:
Oct 12

Each project card should have:

project icon

project name

description

progress

member avatars

task count

status

deadline

Include:

New Project

================================================== 12. PROJECT DETAIL

This should be one of the strongest pages.

Project header:

Payment Platform

Description

Project members

Settings

Invite

Tabs:

Overview
Board
Tasks
Timeline
Files
Chat
Analytics

================================================== 13. KANBAN BOARD

Create a premium Jira/Linear-style Kanban board.

Columns:

BACKLOG
TODO
IN PROGRESS
IN REVIEW
DONE

Cards should show:

Task ID
Title
Priority
Assignee
Labels
Comments
Attachments
Due date

Example:

NEX-142
Implement payment webhook

High
Backend
2 comments
3 files

Use drag-and-drop interactions.

Cards should animate smoothly while moving.

Column headers should display task count.

Add:

Add task

================================================== 14. TEAM PAGE

Create a team management page.

Header:

Engineering

36 members

Team lead:
Raj Kumar Mishra

Tabs:

Members
Activity
Workload

Member table:

Avatar
Name
Role
Department
Active Tasks
Completed
Workload
Status

Example:

Raj Kumar Mishra
Backend Developer
8 tasks
32 completed
High workload
Online

Add member button.

Member profile drawer.

================================================== 15. MEMBER PROFILE

Create detailed member profile.

Avatar

Raj Kumar Mishra

Backend Developer

Online

Sections:

Overview
Tasks
Activity
Performance

Stats:

Active Tasks
8

Completed
32

Projects
5

Completion Rate
91%

Recent activity timeline.

================================================== 16. REAL-TIME CHAT

Create a premium Slack-like messaging interface.

Left:

Channels

general

engineering

backend

frontend

random

Direct messages:

Amit
Priya
Rahul

Center:

Conversation

Header:

backend

36 members

Online indicators.

Messages should look realistic.

Include:

Reply
React
Edit
Delete
Copy
Mention

Bottom composer:

Message #backend...

Attach
Emoji
Send

Show:

"Raj is typing..."

Online users.

Unread messages.

================================================== 17. CALENDAR

Create a professional team calendar.

Views:

Month
Week
Day

Events:

Sprint Planning
Client Demo
Backend Review
Project Deadline
Team Meeting

Use colored but restrained event indicators.

Clicking an event opens a detail modal.

Create Event button.

================================================== 18. FILES

Create a modern file management page.

Folders:

Engineering
Design
Documentation
Reports

Files:

API Documentation.pdf
Database Schema.png
Architecture.pdf
Project Requirements.docx

Columns:

Name
Type
Owner
Size
Modified
Actions

Support:

Upload
Create Folder
Search
Filter
Sort

Use file type icons.

Create preview drawer for files.

================================================== 19. NOTIFICATIONS

Create a dedicated notification center.

Tabs:

All
Mentions
Tasks
Projects
System

Example:

Raj assigned you a task

2 minutes ago

Priya mentioned you in #backend

12 minutes ago

Payment Platform deadline changed

1 hour ago

Allow:

Mark as read
Mark all as read
Notification preferences

================================================== 20. ANALYTICS PAGE

Create a powerful analytics dashboard.

Filters:

Organization
Project
Team
Date range

Metrics:

Task completion rate
Average cycle time
Overdue tasks
Team workload
Project velocity

Charts:

Velocity
Burn-down
Workload
Completion
Activity

Add export button.

Export options:

CSV
PDF

================================================== 21. AUDIT LOGS

Create an enterprise-grade audit log page.

Table:

Timestamp
User
Action
Resource
IP
Status

Examples:

Raj updated task NEX-124

Amit changed project permissions

Admin invited Priya

Raj changed status:
TODO → IN PROGRESS

Include:

Search
Date filter
User filter
Action filter
Export

Audit details open in a drawer.

================================================== 22. ADMIN PANEL

Create an admin dashboard.

Sections:

Users
Organizations
Roles & Permissions
Security
Audit Logs
System Settings

User management table:

User
Email
Role
Status
Last Login
Actions

Actions:

View
Edit
Suspend
Change Role

Role management UI:

SUPER ADMIN
ORG ADMIN
PROJECT MANAGER
TEAM LEAD
MEMBER
GUEST

Permission matrix:

Users
Projects
Tasks
Files
Analytics
Settings

Allow toggling permissions.

================================================== 23. SETTINGS

Create polished settings pages.

Sections:

Profile
Account
Security
Notifications
Appearance
Organization
Members
Roles
Integrations

Security page:

Change Password
Two-factor Authentication
Active Sessions
Login History

Appearance:

Dark
Light
System

Density:

Compact
Comfortable

Notification preferences:

Email
Push
Mentions
Task updates
Project updates

================================================== 24. AUTHENTICATION PAGES

Create beautiful authentication screens.

Pages:

Login
Register
Forgot Password
Reset Password
Email Verification

Login:

NEXUS logo

Welcome back

Email
Password

Remember me

Forgot password?

Sign in

Continue with Google

Register:

Full Name
Email
Password
Confirm Password

Create account

Make these pages visually impressive but not overly flashy.

================================================== 25. ONBOARDING

After registration, create onboarding.

Step 1:

Welcome to NEXUS

Step 2:

Create organization

Step 3:

Choose workspace type

Software Development
Marketing
Education
Operations
Other

Step 4:

Invite teammates

Step 5:

Create first project

Show progress:

1 / 5

Use smooth transitions.

================================================== 26. EMPTY STATES

Do NOT leave blank pages.

Create beautiful empty states.

Example:

No projects yet

"Create your first project and start organizing your team's work."

Create Project

Similarly create empty states for:

Tasks
Messages
Files
Notifications
Teams
Calendar

================================================== 27. LOADING STATES

Use skeleton loaders for:

Dashboard
Task list
Project cards
Messages
Analytics
Tables

Never show ugly generic loading spinners everywhere.

================================================== 28. ERROR STATES

Create polished error UI.

Examples:

Something went wrong

We couldn't load your projects.

Try again

Also:

404 page

403 Access Denied

500 Server Error

================================================== 29. MICRO-INTERACTIONS

Use subtle animations.

Examples:

Button hover
Card hover
Sidebar transitions
Modal transitions
Dropdown transitions
Toast notifications
Task drag animation
Status changes
Page transitions
Skeleton loading
Success animations

Keep animations professional.

Do NOT use excessive animations.

================================================== 30. TOAST SYSTEM

Create reusable toast notifications.

Examples:

✓ Task created successfully

✓ Project updated

✓ Member invited

⚠ You have 3 overdue tasks

✕ Failed to upload file

================================================== 31. MODALS

Create reusable modal components.

Required modals:

Create Task
Create Project
Invite Member
Create Team
Create Event
Upload File
Delete Confirmation
Change Role
Edit Profile

Forms should have:

Validation
Error messages
Loading state
Success state

================================================== 32. COMPONENT SYSTEM

Build reusable components.

Examples:

Button
Input
Select
Dropdown
Modal
Drawer
Tabs
Badge
Avatar
Tooltip
Toast
Table
Pagination
Card
Progress
Skeleton
Date Picker
Command Palette
Kanban Card
Kanban Column
Chart
Empty State
Error State
Breadcrumbs

Do NOT duplicate UI code unnecessarily.

================================================== 33. DATA & STATE

Create realistic mock data.

Use structured mock data for:

Users
Organizations
Projects
Tasks
Messages
Notifications
Files
Calendar events
Audit logs
Analytics

Structure the application so mock API calls can later be replaced with real REST APIs.

Create a clean API service layer.

Example:

/services/api.js

Later it should be easy to replace:

mockGetProjects()

with:

GET /api/projects

================================================== 34. API-READY ARCHITECTURE

Frontend should be prepared for a Node.js + Express backend.

Use a clean structure such as:

src/
components/
pages/
layouts/
hooks/
services/
api/
context/
store/
utils/
types/
data/

Keep business logic separated from presentation.

================================================== 35. BACKEND API CONTRACT PLACEHOLDERS

Create frontend service methods for future endpoints.

Authentication:

POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/me

Organizations:

GET /api/organizations
POST /api/organizations
PATCH /api/organizations/:id

Projects:

GET /api/projects
POST /api/projects
GET /api/projects/:id
PATCH /api/projects/:id
DELETE /api/projects/:id

Tasks:

GET /api/tasks
POST /api/tasks
GET /api/tasks/:id
PATCH /api/tasks/:id
DELETE /api/tasks/:id

Messages:

GET /api/messages
POST /api/messages

Notifications:

GET /api/notifications
PATCH /api/notifications/:id/read

Files:

GET /api/files
POST /api/files

Analytics:

GET /api/analytics

Audit:

GET /api/audit-logs

Do not actually require these APIs yet. Use mock implementations so the frontend works independently.

================================================== 36. ACCESSIBILITY

Follow accessibility best practices.

Use:

Semantic HTML
Keyboard navigation
Visible focus states
ARIA labels
Accessible dialogs
Accessible dropdowns
Readable contrast
Proper form labels

================================================== 37. UX DETAILS

Add breadcrumbs where useful.

Example:

Projects / Payment Platform / Board

Use confirmation dialogs for destructive actions.

For delete:

"Delete project?"

"This action cannot be undone."

Cancel
Delete

Use optimistic UI where appropriate.

Example:

When changing a task status, update UI immediately and then simulate API success.

================================================== 38. MOBILE EXPERIENCE

Mobile dashboard should not simply shrink desktop UI.

Create a proper mobile experience.

Mobile navigation:

Home
Tasks
Projects
Messages
Profile

Use bottom navigation.

Kanban:

Horizontal scrolling columns.

Tables:

Convert into responsive cards.

Task detail:

Full-screen drawer.

Chat:

Full-screen conversation.

================================================== 39. DESIGN QUALITY REQUIREMENT

The final product should look like an actual funded SaaS startup.

Avoid:

Generic dashboard templates

Excessive gradients

Huge text everywhere

Cartoon illustrations

Random colors

Excessive rounded cards

Poor spacing

Tiny text

Cluttered layouts

Fake-looking data

Placeholder lorem ipsum

Unnecessary animations

Focus on:

excellent spacing

visual hierarchy

typography

consistency

strong contrast

polished states

professional icons

meaningful data visualization

intuitive navigation

================================================== 40. LANDING PAGE

Also create a public marketing landing page.

Hero:

NEXUS

"One workspace.
Every team.
Complete visibility."

Subtitle:

"Plan projects, manage tasks, collaborate with your team, communicate in real time, and understand your organization's performance — all from one intelligent workspace."

Buttons:

Get Started
View Demo

Hero visual:

Create a highly polished animated dashboard preview showing:

Kanban board
Analytics
Task updates
Team activity
Notifications

Sections:

Trusted by modern teams

Everything your team needs

Project Management

Real-time Collaboration

Team Analytics

Enterprise Security

Workflow Automation

File Management

Powerful Search

Then:

"Built for teams that move fast."

Add a large product showcase.

Then:

Security section

Role-based access
Audit logs
Secure authentication
Data isolation

Then:

CTA:

"Bring your entire workflow together."

Get Started

================================================== 41. DEMO ACCOUNT

Create a demo mode.

Demo user:

Raj Kumar Mishra

Role:

Organization Admin

Organization:

NEXUS Labs

Pre-populate:

5 projects
36 team members
48 active tasks
127 completed tasks
9 overdue tasks
multiple channels
notifications
files
calendar events
audit logs

================================================== 42. FINAL POLISH

Before finishing:

Check every page for:

Consistent spacing

Consistent typography

Responsive behavior

Working navigation

Working modals

Working dropdowns

Working filters

Working search

Working tabs

Working task interactions

Working notifications

Working toast messages

Loading states

Empty states

Error states

Ensure there are no dead buttons.

Every major interaction should produce visible feedback.

Use realistic enterprise data.

The result should feel like a complete SaaS product, not a student project.

MOST IMPORTANT:

The frontend should immediately communicate:

"Someone serious built this."

Make the dashboard, Kanban board, analytics, task detail, real-time chat, and admin/security sections especially impressive.

Build the frontend as a cohesive product rather than a collection of unrelated pages.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2033e2e7-c669-4ed3-991e-2f6dd91686b7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
