CREATE TABLE "nav_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"label" varchar(100) NOT NULL,
	"href" varchar(500) DEFAULT '#' NOT NULL,
	"icon" varchar(20),
	"description" varchar(255),
	"badge" varchar(50),
	"open_in_new_tab" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nav_items" ADD CONSTRAINT "nav_items_parent_id_nav_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nav_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nav_items_parent_sort_idx" ON "nav_items" USING btree ("parent_id","sort_order");