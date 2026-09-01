# Database Schema — Prisma (PostgreSQL)

Tech stack: Next.js + Prisma + PostgreSQL (Supabase).
Schema mencakup Fase 1 (privat) + fondasi tabel reguler (fase 2).
Uang disimpan sebagai DECIMAL. Waktu disimpan UTC (TIMESTAMPTZ).

## Konvensi
- Model & kolom camelCase di Prisma; map ke snake_case di DB (@map).
- Semua delete menggunakan relasi opsional + onDelete: Restrict
  kecuali yang disebut Cascade.
- Setiap model punya createdAt/updatedAt.

---

## SCHEMA (prisma/schema.prisma)

// ===================== ENUM =====================

enum RoleName {
  super_admin
  admin
  teacher
  student
  parent
}

enum Gender {
  male
  female
}

enum SessionType {
  regular
  private
}

enum SessionStatus {
  scheduled
  in_progress
  completed            // memicu charge + earning
  completed_absent     // murid bolos; memicu charge + earning
  cancelled_student    // murid izin/batal (privat: tanpa tagihan)
  cancelled_teacher    // guru berhalangan / diliburkan
  cancelled_institution // batal karena lembaga → make-up (reguler)
  rescheduled
  excused              // izin reguler disetujui
}

enum AttendanceStatus {
  present
  absent
  excused
  late
  no_info
}

enum BillingPreference {
  per_session
  monthly_bundle
}

enum InvoiceStatus {
  draft
  issued
  paid
  partial
  overdue
  void
}

enum PaymentMethod {
  transfer
  payment_gateway
  cash
  qris
}

enum ChargeStatus { pending invoiced void }
enum EarningStatus { pending approved paid }
enum PayoutStatus { requested approved paid rejected }
enum TeacherRequestStatus { pending approved rejected waitlisted }
enum LeaveType { short long }
enum LeaveStatus { pending approved rejected active ended }
enum SimpleApprovalStatus { pending approved rejected }
enum Relation { father mother guardian }

// ===================== USER & ROLE =====================

model User {
  id            String   @id @default(uuid())
  fullName      String
  email         String?  @unique
  phone         String?  @unique
  passwordHash  String
  photoUrl      String?
  gender        Gender?
  birthDate     DateTime?
  address       String?
  timezone      String   @default("Asia/Jakarta")
  isActive      Boolean  @default(true)
  billingPreference BillingPreference @default(per_session) // untuk murid privat
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  roles         UserRole[]
  children      ParentStudent[]  @relation("children")
  parents       ParentStudent[]  @relation("parents")
  teacherProfile TeacherProfile?
  sessionsAsTeacher    Session[]  @relation("SessionTeacher")
  sessionsAsSubstitute Session[]  @relation("SessionSubstitute")
  sessionsAsStudent    Session[]  @relation("SessionStudent")
  enrollments   Enrollment[]
  notifications Notification[]
  customRate    StudentCustomRate?
  charges       SessionCharge[]
  invoices      Invoice[]
  earnings      SessionEarning[]
  payouts       Payout[]
}

model Role {
  id      Int        @id @default(autoincrement())
  name    RoleName   @unique
  users   UserRole[]
}

model UserRole {
  userId String
  roleId Int
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [id])
  @@id([userId, roleId])
}

model ParentStudent {
  parentId  String
  studentId String
  relation  Relation
  isPrimary Boolean @default(false)
  createdAt DateTime @default(now())
  parent    User @relation("parents", fields: [parentId], references: [id])
  student   User @relation("children", fields: [studentId], references: [id])
  @@id([parentId, studentId])
}

model TeacherProfile {
  userId            String  @id
  bio               String?
  qualifications    String?
  sanadInfo         String?
  specialties       String[]
  acceptsPrivate    Boolean @default(false)
  acceptingStudents Boolean @default(true)
  yearsExperience   Int?
  revenueSharePct   Decimal @default(60.00) @db.Decimal(5, 2)
  user              User @relation(fields: [userId], references: [id])
}

// ===================== COURSE (fondasi fase 2) =====================

model Course {
  id            String  @id @default(uuid())
  name          String
  slug          String  @unique
  description   String?
  levelNumber   Int?
  deliveryType  String  // periodic | self_paced | public_kajian
  prerequisiteCourseId String?
  isActive      Boolean @default(true)
  classGroups   ClassGroup[]
}

model AcademicPeriod {
  id          String   @id @default(uuid())
  name        String
  startDate   DateTime @db.Date
  endDate     DateTime @db.Date
  enrollmentOpenAt  DateTime?
  enrollmentCloseAt DateTime?
  isActive    Boolean  @default(true)
  classGroups ClassGroup[]
}

model ClassGroup {
  id        String  @id @default(uuid())
  courseId  String
  periodId  String
  name      String
  capacity  Int     @default(15)
  price     Decimal @db.Decimal(12, 2)
  status    String  @default("open") // open | closed | archived
  course    Course         @relation(fields: [courseId], references: [id])
  period    AcademicPeriod @relation(fields: [periodId], references: [id])
  sessions  Session[]
  enrollments Enrollment[]
}

model Enrollment {
  id            String  @id @default(uuid())
  studentId     String
  classGroupId  String
  status        String  @default("active") // active | completed | dropped | suspended
  finalGrade    Decimal? @db.Decimal(5, 2)
  student       User       @relation(fields: [studentId], references: [id])
  classGroup    ClassGroup @relation(fields: [classGroupId], references: [id])
  @@unique([studentId, classGroupId])
}

// ===================== SESSIONS (inti) =====================

model Session {
  id          String  @id @default(uuid())
  type        SessionType
  classGroupId String?          // untuk regular
  teacherId   String?           // untuk private
  studentId   String?           // untuk private
  substituteTeacherId String?

  title       String?
  scheduledAt DateTime
  durationMinutes Int @default(60)
  meetingUrl  String?
  meetingProvider String? // zoom | google_meet | builtin
  recordingUrl String?

  status      SessionStatus @default(scheduled)
  isMakeupFor String?  // id sesi yang digantikan
  isEmergency Boolean  @default(false)
  notes       String?
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  classGroup  ClassGroup @relation(fields: [classGroupId], references: [id])
  teacher     User @relation("SessionTeacher",     fields: [teacherId],  references: [id])
  substitute  User @relation("SessionSubstitute", fields: [substituteTeacherId], references: [id])
  student     User @relation("SessionStudent",    fields: [studentId],  references: [id])

  attendances  SessionAttendance[]
  grades       SessionGrade[]
  feedbacks    SessionFeedback[]
  charge       SessionCharge?
  earning      SessionEarning?
  rescheduleRequests RescheduleRequest[]

  @@index([classGroupId, scheduledAt])
  @@index([teacherId, scheduledAt])
  @@index([studentId, scheduledAt])
  @@index([scheduledAt])
}

model SessionAttendance {
  id          String  @id @default(uuid())
  sessionId   String
  studentId   String
  status      AttendanceStatus @default(no_info)
  excuseReason String?
  excuseAttachmentUrl String?
  markedAt    DateTime?
  markedBy    String?
  session     Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  @@unique([sessionId, studentId])
}

model GradeCriterion {
  id     Int    @id @default(autoincrement())
  name   String // Makharijul Huruf, Sifatul Huruf, Tajwid, Kelancaran
  description String?
  maxScore Decimal @default(100) @db.Decimal(5, 2)
  scope  String @default("both") // regular | private | both
  grades SessionGrade[]
}

model SessionGrade {
  id          String  @id @default(uuid())
  sessionId   String
  studentId   String
  criterionId Int
  score       Decimal @db.Decimal(5, 2)
  assessorId  String
  session   Session        @relation(fields: [sessionId], references: [id])
  criterion GradeCriterion @relation(fields: [criterionId], references: [id])
  @@unique([sessionId, studentId, criterionId])
}

model SessionFeedback {
  id          String @id @default(uuid())
  sessionId   String
  studentId   String
  teacherId   String
  strengths   String?
  improvements String?
  nextTarget  String?
  audioNoteUrl String?
  createdAt   DateTime @default(now())
  session     Session @relation(fields: [sessionId], references: [id])
}

// ===================== PRIVATE SCHEDULING =====================

model PrivateRecurringSchedule {
  id          String @id @default(uuid())
  teacherId   String
  studentId   String
  dayOfWeek   Int    // 0=Minggu .. 6=Sabtu
  startTime   String // format "16:00" (waktu lokal timezone user)
  durationMinutes Int
  meetingUrl  String?
  isActive    Boolean @default(true)
  effectiveFrom  DateTime? @db.Date
  effectiveUntil DateTime? @db.Date
  @@unique([teacherId, studentId, dayOfWeek, startTime])
}

model StudentBreak {
  id        String @id @default(uuid())
  studentId String
  teacherId String
  startDate DateTime @db.Date
  endDate   DateTime @db.Date
  reason    String?
  status    SimpleApprovalStatus @default(pending)
}

model TeacherLeave {
  id          String @id @default(uuid())
  teacherId   String
  type        LeaveType
  reason      String
  startDate   DateTime @db.Date
  endDate     DateTime? @db.Date
  resolution  String? // substitute | pause | cancelled
  substituteTeacherId String?
  status      LeaveStatus @default(pending)
  approvedBy  String?
  createdAt   DateTime @default(now())
}

model RescheduleRequest {
  id          String @id @default(uuid())
  sessionId   String
  requestedBy String
  proposedAt  DateTime
  reason      String?
  status      SimpleApprovalStatus @default(pending)
  respondedBy String?
  createdAt   DateTime @default(now())
  session     Session @relation(fields: [sessionId], references: [id])
}

model TeacherRequest {
  id            String @id @default(uuid())
  studentId     String
  teacherId     String? // NULL = percayakan admin
  preferredDurations Int[]
  preferredTimes Json?  // {mon: ["15:00-17:00"]}
  note          String?
  status        TeacherRequestStatus @default(pending)
  handledBy     String?
  createdAt     DateTime @default(now())
}

// ===================== PRICING & BILLING =====================

model PricingTier {
  id              String  @id @default(uuid())
  durationMinutes Int     @unique
  price           Decimal @db.Decimal(12, 2)
  isActive        Boolean @default(true)
}

model StudentCustomRate {
  studentId   String  @id
  customPrice Json    // {30: 50000, 45: 70000, 60: 90000} (rupiah)
  student     User @relation(fields: [studentId], references: [id])
}

model SessionCharge {
  id        String  @id @default(uuid())
  sessionId String  @unique   // idempotency: 1 sesi = 1 charge
  studentId String
  durationMinutes Int
  amount    Decimal @db.Decimal(12, 2)
  status    ChargeStatus @default(pending)
  createdAt DateTime @default(now())
  session   Session @relation(fields: [sessionId], references: [id])
  student   User    @relation(fields: [studentId], references: [id])
  invoiceItems InvoiceItem[]
}

model Invoice {
  id            String  @id @default(uuid())
  invoiceNumber String  @unique
  studentId     String
  periodId      String? // untuk reguler (fase 2)
  issueDate     DateTime @db.Date
  dueDate       DateTime @db.Date
  subtotal      Decimal @db.Decimal(12, 2)
  discount      Decimal @default(0) @db.Decimal(12, 2)
  total         Decimal @db.Decimal(12, 2)
  status        InvoiceStatus @default(draft)
  paidAt        DateTime?
  createdAt     DateTime @default(now())
  student       User  @relation(fields: [studentId], references: [id])
  items         InvoiceItem[]
  payments      Payment[]
}

model InvoiceItem {
  id        String  @id @default(uuid())
  invoiceId String
  description String
  sessionChargeId String? @unique
  amount    Decimal @db.Decimal(12, 2)
  invoice   Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  sessionCharge SessionCharge? @relation(fields: [sessionChargeId], references: [id])
}

model Payment {
  id        String  @id @default(uuid())
  invoiceId String
  amount    Decimal @db.Decimal(12, 2)
  method    PaymentMethod
  reference String?
  proofUrl  String?
  verifiedBy String?
  paidAt    DateTime @default(now())
  invoice   Invoice @relation(fields: [invoiceId], references: [id])
}

// ===================== EARNINGS & PAYOUT =====================

model SessionEarning {
  id        String  @id @default(uuid())
  sessionId String  @unique
  teacherId String
  amount    Decimal @db.Decimal(12, 2)
  status    EarningStatus @default(pending)
  createdAt DateTime @default(now())
  session   Session @relation(fields: [sessionId], references: [id])
  teacher   User    @relation(fields: [teacherId], references: [id])
  payoutItems PayoutItem[]
}

model Payout {
  id          String  @id @default(uuid())
  teacherId   String
  totalAmount Decimal @db.Decimal(12, 2)
  status      PayoutStatus @default(requested)
  paidAt      DateTime?
  processedBy String?
  teacher     User @relation(fields: [teacherId], references: [id])
  items       PayoutItem[]
}

model PayoutItem {
  id               String @id @default(uuid())
  payoutId         String
  sessionEarningId String @unique
  payout           Payout @relation(fields: [payoutId], references: [id], onDelete: Cascade)
  sessionEarning   SessionEarning @relation(fields: [sessionEarningId], references: [id])
}

// ===================== NOTIFICATION & AUDIT =====================

model Notification {
  id        String  @id @default(uuid())
  userId    String
  type      String  // session_cancelled, invoice_issued, feedback_new, dst
  title     String
  body      String?
  data      Json?
  channel   String  @default("in_app") // in_app | email
  readAt    DateTime?
  createdAt DateTime @default(now())
  user      User @relation(fields: [userId], references: [id])
  @@index([userId, readAt])
}

model AuditLog {
  id        String @id @default(uuid())
  actorId   String
  entity    String // Invoice, SessionCharge, Payout, Session
  entityId  String
  action    String // status_change, void, approve, dst
  oldData   Json?
  newData   Json?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
}

// ===================== KAJIAN (fase 3, fondasi) =====================

model KajianEvent {
  id          String @id @default(uuid())
  title       String
  description String?
  speaker     String?
  scheduledAt DateTime
  meetingUrl  String?
  recordingUrl String?
  registrations KajianRegistration[]
}

model KajianRegistration {
  eventId  String
  userId   String
  attended Boolean @default(false)
  event    KajianEvent @relation(fields: [eventId], references: [id])
  @@id([eventId, userId])
}

---

## Catatan Desain untuk Developer

1. IDEMPOTENCY KEUANGAN:
   - SessionCharge.sessionId @unique → 1 sesi max 1 charge.
   - SessionEarning.sessionId @unique → 1 sesi max 1 earning.
   - InvoiceItem.sessionChargeId @unique → 1 charge max di 1 invoice.
   - Pembuatan charge/earning dilakukan dalam SATU transaksi DB,
     dipicu saat guru menandai sesi completed/completed_absent.

2. GENERATOR SESI RECURRING (cron harian):
   - Baca PrivateRecurringSchedule aktif → untuk 14 hari ke depan,
     hitung tanggal yang dayOfWeek-nya cocok.
   - Skip jika: StudentBreak aktif menjangkau tanggal, TeacherLeave
     long aktif, atau Session dengan (teacherId, scheduledAt) sudah ada.
   - meetingUrl dicopy dari template.

3. SNAPSHOT HARGA:
   - Saat charge dibuat: cek StudentCustomRate murid (durasi sesuai)
     → jika tidak ada, cek PricingTier sesuai durasi → simpan amount.
   - Jangan pernah join ke PricingTier saat menampilkan tagihan lama.

4. CHECK CONSTRAINT tambahan (raw SQL migration):
   - Session private: teacherId & studentId NOT NULL, classGroupId NULL.
   - Session regular: classGroupId NOT NULL, teacherId & studentId NULL.
   - PayoutItem hanya boleh berisi earning berstatus approved
     (divalidasi di aplikasi).

5. TIMEZONE:
   - scheduledAt disimpan UTC; startTime di recurring schedule disimpan
     sebagai string waktu lokal "Asia/Jakarta" (guru membayarnya begitu).
   - Konversi dilakukan di aplikasi.

6. DECIMAL JANGAN FLOAT:
   - Semua kolom uang Decimal(12,2). Di TypeScript gunakan Prisma
     Decimal atau konversi ke integer rupiah saat kalkulasi.
