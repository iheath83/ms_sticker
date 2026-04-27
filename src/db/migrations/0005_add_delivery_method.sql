ALTER TABLE "orders" ADD COLUMN "delivery_method" varchar(30);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "min_qty" integer DEFAULT 1 NOT NULL;