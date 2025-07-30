-- CreateTable
CREATE TABLE "PasswordResetAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetAttempt_email_createdAt_idx" ON "PasswordResetAttempt"("email", "createdAt");

-- CreateIndex
CREATE INDEX "PasswordResetAttempt_ipAddress_createdAt_idx" ON "PasswordResetAttempt"("ipAddress", "createdAt");
