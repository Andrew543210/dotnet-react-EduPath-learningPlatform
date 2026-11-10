import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { GuestOnly, RequireRole } from '@/auth/guards'
import { NotFoundPage, RouteErrorPage } from '@/pages/public/ErrorPages'
import { HomePage } from '@/pages/public/HomePage'
import { AdminLayout, BareLayout, RouteRoot, SiteLayout, TeachLayout } from './layout/Layouts'

const page = (load: () => Promise<{ default: ComponentType }>) => ({
  lazy: async () => ({ Component: (await load()).default }),
})

const appRoutes: RouteObject[] = [
  {
    element: <BareLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <RequireRole />,
        children: [{ path: 'learn/lessons/:id', ...page(() => import('@/pages/student/LessonPage')) }],
      },
    ],
  },
  {
    element: <SiteLayout />,
    children: [
      { path: 'catalog', ...page(() => import('@/pages/public/CatalogPage')) },
      { path: 'courses/:id', ...page(() => import('@/pages/public/CoursePage')) },
      { path: 'teachers/:id', ...page(() => import('@/pages/public/TeacherPage')) },
      { path: 'verify/:number?', ...page(() => import('@/pages/public/VerifyPage')) },
      {
        element: <GuestOnly />,
        children: [
          { path: 'login', ...page(() => import('@/pages/public/LoginPage')) },
          { path: 'register', ...page(() => import('@/pages/public/RegisterPage')) },
        ],
      },
      {
        element: <RequireRole roles={['Student']} />,
        children: [
          { path: 'learn', ...page(() => import('@/pages/student/LearnPage')) },
          { path: 'courses/:id/checkout', ...page(() => import('@/pages/student/CheckoutPage')) },
          { path: 'payments', ...page(() => import('@/pages/student/PaymentsPage')) },
          { path: 'payments/:id', ...page(() => import('@/pages/student/PaymentPage')) },
          { path: 'certificates', ...page(() => import('@/pages/student/CertificatesPage')) },
          { path: 'learn/results/:id', ...page(() => import('@/pages/student/ResultPage')) },
        ],
      },
      {
        element: <RequireRole />,
        children: [
          { path: 'learn/tests/:id', ...page(() => import('@/pages/student/TestPage')) },
          { path: 'certificates/:id', ...page(() => import('@/pages/student/CertificatePage')) },
          { path: 'notifications', ...page(() => import('@/pages/student/NotificationsPage')) },
          { path: 'profile', ...page(() => import('@/pages/student/ProfilePage')) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: 'teach',
    element: <RequireRole roles={['Teacher', 'Admin']} />,
    children: [
      {
        element: <TeachLayout />,
        children: [
          { index: true, ...page(() => import('@/pages/teach/TeachOverviewPage')) },
          { path: 'courses', ...page(() => import('@/pages/teach/TeachCoursesPage')) },
          { path: 'courses/new', ...page(() => import('@/pages/teach/NewCoursePage')) },
          { path: 'courses/:id', ...page(() => import('@/pages/teach/CourseEditorPage')) },
          { path: 'courses/:id/students', ...page(() => import('@/pages/teach/CourseStudentsPage')) },
        ],
      },
    ],
  },
  {
    path: 'admin',
    element: <RequireRole roles={['Admin']} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, ...page(() => import('@/pages/admin/AdminOverviewPage')) },
          { path: 'moderation', ...page(() => import('@/pages/admin/ModerationPage')) },
          { path: 'users', ...page(() => import('@/pages/admin/UsersPage')) },
          { path: 'categories', ...page(() => import('@/pages/admin/CategoriesPage')) },
          { path: 'reviews', ...page(() => import('@/pages/admin/ReviewsPage')) },
          { path: 'broadcast', ...page(() => import('@/pages/admin/BroadcastPage')) },
          { path: 'settings', ...page(() => import('@/pages/admin/SettingsPage')) },
        ],
      },
    ],
  },
]

export const routes: RouteObject[] = [{ element: <RouteRoot />, errorElement: <RouteErrorPage />, children: appRoutes }]

export const createRouter = () => createBrowserRouter(routes)
