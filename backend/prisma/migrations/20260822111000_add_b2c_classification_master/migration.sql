-- Client B2C labels are retained as master data. They are not treated as
-- Business accounts or as a replacement for the fixed B2B/B2C request type.
ALTER TYPE "MasterDataCategory" ADD VALUE IF NOT EXISTS 'B2C_CLASSIFICATION';
