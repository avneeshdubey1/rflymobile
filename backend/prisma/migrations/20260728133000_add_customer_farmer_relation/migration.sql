-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_farmerUserId_fkey" FOREIGN KEY ("farmerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
