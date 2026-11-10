export type UserRole = 'Student' | 'Teacher' | 'Admin'
export type TrailColor = 'Blue' | 'Red' | 'Green' | 'Yellow'
export type CourseStatus = 'Draft' | 'PendingReview' | 'Published' | 'Rejected' | 'Archived'
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced'
export type EnrollmentStatus = 'Pending' | 'Active' | 'Completed'
export type PaymentStatus = 'Pending' | 'Succeeded' | 'Failed'
export type NotificationType = 'General' | 'Course' | 'Payment' | 'Test' | 'Certificate' | 'Moderation' | 'Announcement'
export type LearningState =
  | 'CourseNotPurchased'
  | 'AwaitingPayment'
  | 'ProcessingPayment'
  | 'EnrolledInCourse'
  | 'CourseInProgress'
  | 'ViewingLesson'
  | 'TakingTest'
  | 'LessonCompleted'
  | 'CourseCompleted'
  | 'CertificateGenerated'
  | 'Finished'
export type CourseSort = 'Popular' | 'Newest' | 'Rating' | 'PriceAsc' | 'PriceDesc'
export type PriceFilter = 'Any' | 'Free' | 'Paid'

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  headline: string | null
  bio: string | null
  isBlocked: boolean
  createdAt: string
  lastLoginAt: string | null
}

export interface AuthResponse {
  accessToken: string
  expiresAt: string
  user: User
}

export interface Category {
  id: number
  name: string
  slug: string
  description: string
  trail: TrailColor
  courseCount: number
}

export interface CourseCard {
  id: number
  title: string
  summary: string
  price: number
  level: CourseLevel
  status: CourseStatus
  categoryId: number
  categoryName: string
  trail: TrailColor
  teacherId: number
  teacherName: string
  lessonCount: number
  durationMinutes: number
  studentCount: number
  rating: number | null
  reviewCount: number
  publishedAt: string | null
  updatedAt: string
}

export interface Teacher {
  id: number
  name: string
  headline: string | null
  bio: string | null
  courseCount: number
  studentCount: number
}

export interface SyllabusLesson {
  id: number
  title: string
  orderNumber: number
  durationMinutes: number
  hasTest: boolean
  isCompleted: boolean
}

export interface LearnerState {
  state: LearningState
  enrollmentStatus: EnrollmentStatus | null
  progress: number
  nextLessonId: number | null
  certificateId: number | null
  canReview: boolean
}

export interface CourseDetails {
  course: CourseCard
  description: string
  outcomes: string[]
  teacher: Teacher
  lessons: SyllabusLesson[]
  testCount: number
  learner: LearnerState | null
  isPreview: boolean
  moderationComment: string | null
}

export interface TeacherProfile {
  teacher: Teacher
  courses: CourseCard[]
}

export interface Enrollment {
  id: number
  courseId: number
  status: EnrollmentStatus
  progress: number
  enrolledAt: string
}

export interface RouteStop {
  id: number
  title: string
  hasTest: boolean
  isCompleted: boolean
}

export interface MyCourse {
  courseId: number
  title: string
  trail: TrailColor
  categoryName: string
  teacherName: string
  progress: number
  status: EnrollmentStatus
  nextLessonId: number | null
  nextLessonTitle: string | null
  certificateId: number | null
  enrolledAt: string
  lastActivityAt: string | null
  route: RouteStop[]
}

export interface LessonTest {
  id: number
  title: string
  passingScore: number
  questionCount: number
  attempts: number
  bestScore: number | null
  passed: boolean
}

export interface Lesson {
  id: number
  courseId: number
  courseTitle: string
  trail: TrailColor
  title: string
  content: string
  orderNumber: number
  durationMinutes: number
  videoUrl: string | null
  materialUrl: string | null
  materialName: string | null
  tests: LessonTest[]
  isCompleted: boolean
  prevLessonId: number | null
  nextLessonId: number | null
  courseProgress: number
  route: RouteStop[]
  isPreview: boolean
}

export interface LessonProgress {
  courseProgress: number
  courseCompleted: boolean
  nextLessonId: number | null
  certificateId: number | null
  nextState: LearningState
}

export interface TestQuestion {
  id: number
  text: string
  options: string[]
}

export interface TestSession {
  id: number
  title: string
  lessonId: number
  lessonTitle: string
  courseId: number
  courseTitle: string
  passingScore: number
  attemptNumber: number
  questions: TestQuestion[]
}

export interface AnswerReview {
  questionId: number
  question: string
  selectedAnswer: string
  isCorrect: boolean
  correctAnswer: string | null
  explanation: string | null
}

export interface TestResult {
  id: number
  testId: number
  testTitle: string
  lessonId: number
  lessonTitle: string
  courseId: number
  courseTitle: string
  score: number
  passed: boolean
  passingScore: number
  attemptNumber: number
  completedAt: string
  correctCount: number
  totalCount: number
  courseProgress: number
  nextState: LearningState
  nextLessonId: number | null
  certificateId: number | null
  answers: AnswerReview[]
}

export interface ResultSummary {
  id: number
  testId: number
  testTitle: string
  courseTitle: string
  score: number
  passed: boolean
  completedAt: string
}

export interface Payment {
  id: number
  courseId: number
  courseTitle: string
  amount: number
  currency: string
  status: PaymentStatus
  paymentDate: string
  transactionId: string | null
  failureReason: string | null
  cardLast4: string | null
  accessGranted: boolean
  firstLessonId: number | null
}

export interface Certificate {
  id: number
  number: string
  issueDate: string
  courseId: number
  courseTitle: string
  trail: TrailColor
  studentName: string
  teacherName: string
  finalScore: number | null
  lessonCount: number
  durationMinutes: number
  fileUrl: string | null
}

export interface Notification {
  id: number
  type: NotificationType
  message: string
  link: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationPage {
  page: PagedResult<Notification>
  unreadCount: number
}

export interface Review {
  id: number
  courseId: number
  rating: number
  comment: string
  authorName: string
  createdAt: string
  updatedAt: string
  isMine: boolean
}

export interface CourseReviews {
  summary: { average: number | null; count: number; distribution: number[] }
  page: PagedResult<Review>
  mine: Review | null
}

export interface PublicSettings {
  platformName: string
  supportEmail: string
  allowTeacherRegistration: boolean
}

export interface WeeklyPoint {
  weekStart: string
  value: number
}

export interface TeacherOverview {
  courseCount: number
  publishedCount: number
  studentCount: number
  completedCount: number
  averageScore: number | null
  averageRating: number | null
  revenue: number
  enrollmentsByWeek: WeeklyPoint[]
}

export interface EditorQuestion {
  id: number
  text: string
  options: string[]
  correctAnswer: string
  explanation: string | null
}

export interface EditorTest {
  id: number
  title: string
  passingScore: number
  hasResults: boolean
  questions: EditorQuestion[]
}

export interface EditorLesson {
  id: number
  title: string
  content: string
  orderNumber: number
  durationMinutes: number
  videoUrl: string | null
  materialUrl: string | null
  materialName: string | null
  tests: EditorTest[]
}

export interface CourseEditor {
  id: number
  title: string
  summary: string
  description: string
  price: number
  level: CourseLevel
  categoryId: number
  outcomes: string[]
  status: CourseStatus
  moderationComment: string | null
  updatedAt: string
  studentCount: number
  defaultPassingScore: number
  lessons: EditorLesson[]
}

export interface StudentProgress {
  userId: number
  name: string
  email: string
  progress: number
  status: EnrollmentStatus
  enrolledAt: string
  lastActivityAt: string | null
  attempts: number
  averageScore: number | null
  hasCertificate: boolean
}

export interface CourseStudents {
  courseTitle: string
  stats: {
    studentCount: number
    completedCount: number
    averageProgress: number
    averageScore: number | null
    revenue: number
    rating: number | null
  }
  students: StudentProgress[]
  funnel: { lessonId: number; orderNumber: number; title: string; completedCount: number }[]
}

export interface AdminOverview {
  students: number
  teachers: number
  admins: number
  publishedCourses: number
  pendingCourses: number
  draftCourses: number
  activeEnrollments: number
  completedEnrollments: number
  certificates: number
  revenue: number
  successfulPayments: number
  failedPayments: number
  revenueByWeek: WeeklyPoint[]
  signupsByWeek: WeeklyPoint[]
}

export interface AdminUser {
  id: number
  name: string
  email: string
  role: UserRole
  isBlocked: boolean
  createdAt: string
  lastLoginAt: string | null
  enrollments: number
  courses: number
}

export interface ModerationItem {
  course: CourseCard
  moderationComment: string | null
  testCount: number
}

export interface AdminReview {
  id: number
  courseId: number
  courseTitle: string
  rating: number
  comment: string
  authorName: string
  createdAt: string
}

export interface Settings {
  platformName: string
  supportEmail: string
  defaultPassingScore: number
  allowTeacherRegistration: boolean
  requireCourseModeration: boolean
}
