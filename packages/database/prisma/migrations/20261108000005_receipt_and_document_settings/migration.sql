-- CreateEnum
CREATE TYPE "ReceiptPaperSize" AS ENUM ('MM_58', 'MM_80', 'A4');

-- AlterTable
ALTER TABLE "business_settings"
    ADD COLUMN "receipt_paper_size" "ReceiptPaperSize" NOT NULL DEFAULT 'MM_80',
    ADD COLUMN "show_logo_on_receipt" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "show_tax_details" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "show_barcode_on_receipt" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "receipt_header" TEXT,
    ADD COLUMN "return_policy_text" TEXT;

