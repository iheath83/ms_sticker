CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"blocks" jsonb NOT NULL,
	"design_json" jsonb,
	"rendered_html" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"sku" varchar(100),
	"material" varchar(50) NOT NULL,
	"available_finishes" text[] DEFAULT '{"gloss"}' NOT NULL,
	"shapes" text[] DEFAULT '{"die-cut","circle","square"}' NOT NULL,
	"base_price_cents" integer NOT NULL,
	"min_qty" integer DEFAULT 1 NOT NULL,
	"weight_grams" integer DEFAULT 100 NOT NULL,
	"min_width_mm" integer DEFAULT 20 NOT NULL,
	"max_width_mm" integer DEFAULT 300 NOT NULL,
	"min_height_mm" integer DEFAULT 20 NOT NULL,
	"max_height_mm" integer DEFAULT 300 NOT NULL,
	"tiers" jsonb,
	"size_prices" jsonb,
	"custom_presets" jsonb,
	"image_url" text,
	"images" jsonb DEFAULT '[]'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "label" varchar(50);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "first_name" varchar(100);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "last_name" varchar(100);--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_files" ADD COLUMN "order_item_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sendcloud_parcel_id" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "sendcloud_order_id" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_label_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tagline" varchar(500);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "features" text[];--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "requires_customization" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_idx" ON "product_variants" USING btree ("sku");--> statement-breakpoint
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;