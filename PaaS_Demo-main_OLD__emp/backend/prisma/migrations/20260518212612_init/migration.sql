-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Pilot', 'Ops', 'Finance');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('BB', 'BC');

-- CreateEnum
CREATE TYPE "RequestSource" AS ENUM ('WalkIn', 'Phone', 'WhatsApp', 'PartnerReferral', 'Other');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('Pending', 'Assigned', 'Accepted', 'RepresentativeApprovalPending', 'RepresentativeRejected', 'InProgress', 'Completed', 'PaymentReceived', 'TrackerUpdated', 'Invoiced');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('Draft', 'Sent', 'Paid', 'Overdue');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('info', 'success', 'warning', 'error');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL,
    "address" TEXT,
    "region" TEXT,
    "billingCycleDays" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" UUID NOT NULL,
    "requestNumber" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "customerType" "CustomerType" NOT NULL,
    "cropType" TEXT NOT NULL,
    "fieldAreaAcres" DECIMAL(10,2) NOT NULL,
    "requestedDate" DATE NOT NULL,
    "requestedTimeSlot" TEXT NOT NULL,
    "chemical" TEXT,
    "sourceOfRequest" "RequestSource" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'Pending',
    "amountPerAcre" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PilotAssignment" (
    "id" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "pilotId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "startSprayingAt" TIMESTAMP(3),
    "completeSprayingAt" TIMESTAMP(3),

    CONSTRAINT "PilotAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BBRepresentativeApproval" (
    "id" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "representativeName" TEXT NOT NULL,
    "representativePhone" TEXT NOT NULL,
    "informedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isApproved" BOOLEAN NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "BBRepresentativeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BCPayment" (
    "id" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "upiTransactionRef" TEXT NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminInformedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BCPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionChecklist" (
    "id" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "representativeInformedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billCollected" BOOLEAN NOT NULL DEFAULT false,
    "billPhotoUrl" TEXT,
    "screenshotSharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "screenshotUrl" TEXT,

    CONSTRAINT "CompletionChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestTrackerEntry" (
    "id" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "updatedByOpsUserId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL,

    CONSTRAINT "RequestTrackerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "invoiceNumber" SERIAL NOT NULL,
    "customerId" UUID NOT NULL,
    "billingPeriodStart" DATE NOT NULL,
    "billingPeriodEnd" DATE NOT NULL,
    "jobIds" UUID[],
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'Draft',
    "pdfUrl" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "PilotAssignment_serviceRequestId_key" ON "PilotAssignment"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "BBRepresentativeApproval_serviceRequestId_key" ON "BBRepresentativeApproval"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "BCPayment_serviceRequestId_key" ON "BCPayment"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "CompletionChecklist_serviceRequestId_key" ON "CompletionChecklist"("serviceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestTrackerEntry_serviceRequestId_key" ON "RequestTrackerEntry"("serviceRequestId");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotAssignment" ADD CONSTRAINT "PilotAssignment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PilotAssignment" ADD CONSTRAINT "PilotAssignment_pilotId_fkey" FOREIGN KEY ("pilotId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BBRepresentativeApproval" ADD CONSTRAINT "BBRepresentativeApproval_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BCPayment" ADD CONSTRAINT "BCPayment_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionChecklist" ADD CONSTRAINT "CompletionChecklist_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestTrackerEntry" ADD CONSTRAINT "RequestTrackerEntry_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestTrackerEntry" ADD CONSTRAINT "RequestTrackerEntry_updatedByOpsUserId_fkey" FOREIGN KEY ("updatedByOpsUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationItem" ADD CONSTRAINT "NotificationItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
