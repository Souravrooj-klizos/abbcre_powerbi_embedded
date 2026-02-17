-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowerBIReport" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PowerBIReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserReportRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "powerbiReportId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserReportRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PowerBIReport_workspaceId_reportId_key" ON "PowerBIReport"("workspaceId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "UserReportRole_userId_powerbiReportId_roleName_key" ON "UserReportRole"("userId", "powerbiReportId", "roleName");

-- AddForeignKey
ALTER TABLE "UserReportRole" ADD CONSTRAINT "UserReportRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserReportRole" ADD CONSTRAINT "UserReportRole_powerbiReportId_fkey" FOREIGN KEY ("powerbiReportId") REFERENCES "PowerBIReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
