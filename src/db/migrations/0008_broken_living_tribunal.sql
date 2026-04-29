CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"maintenance_enabled" boolean DEFAULT false NOT NULL,
	"maintenance_title" varchar(255) DEFAULT 'Bientôt disponible' NOT NULL,
	"maintenance_message" text DEFAULT 'Notre site est en cours de mise à jour. Revenez très vite !' NOT NULL,
	"maintenance_email" varchar(255) DEFAULT 'hello@msadhesif.fr' NOT NULL,
	"maintenance_phone" varchar(50) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
