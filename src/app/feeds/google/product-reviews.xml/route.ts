import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { reviews, products } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const APP_URL = (process.env.APP_URL ?? "https://msadhesif.fr").replace(/\/$/, "");
const BRAND = "MS Adhésif";
const PUBLISHER_NAME = "MS Adhésif";
const PUBLISHER_URL = APP_URL;

function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso8601(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function GET(_req: NextRequest) {
  // Load all published product reviews
  const allReviews = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.status, "published"), eq(reviews.type, "product")))
    .orderBy(reviews.publishedAt);

  // Load related products
  const productIds = [...new Set(allReviews.map((r) => r.productId).filter(Boolean) as string[])];
  const productMap = new Map<string, typeof products.$inferSelect>();

  if (productIds.length > 0) {
    const productRows = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));
    for (const p of productRows) productMap.set(p.id, p);
  }

  // Build XML
  const reviewNodes = allReviews
    .map((review) => {
      const product = review.productId ? productMap.get(review.productId) : null;
      const reviewerName = review.displayName ?? review.customerName ?? "Client vérifié";
      const reviewerEmailHash = hashEmail(review.customerEmail);
      const productUrl = product ? `${APP_URL}/products/${product.slug}` : APP_URL;
      const reviewUrl = product
        ? `${APP_URL}/products/${product.slug}#review-${review.id}`
        : `${APP_URL}#review-${review.id}`;

      const sku = product?.sku ?? product?.slug ?? review.productId ?? "";
      const gtin = product?.gtin ?? "";
      const mpn = product?.mpn ?? "";
      const brand = product?.brand ?? BRAND;
      const productName = product?.name ?? "Produit MS Adhésif";

      const collectionMethod =
        review.source === "post_purchase_email"
          ? "post_fulfillment_review"
          : review.source === "onsite_form"
          ? "unsolicited"
          : "unsolicited";

      return `    <review>
      <review_id><![CDATA[${review.id}]]></review_id>
      <reviewer>
        <name><![CDATA[${escapeXml(reviewerName)}]]></name>
        <reviewer_id>${reviewerEmailHash}</reviewer_id>
        <is_anonymous>false</is_anonymous>
      </reviewer>
      <review_timestamp>${toIso8601(review.publishedAt ?? review.createdAt)}</review_timestamp>
      ${review.title ? `<title><![CDATA[${escapeXml(review.title)}]]></title>` : ""}
      <content><![CDATA[${escapeXml(review.body ?? review.title ?? "")}]]></content>
      <review_url type="singleton"><![CDATA[${reviewUrl}]]></review_url>
      <ratings>
        <overall min="1" max="5">${review.rating}</overall>
      </ratings>
      <products>
        <product>
          <product_ids>
            ${gtin ? `<gtins><gtin>${escapeXml(gtin)}</gtin></gtins>` : ""}
            ${mpn ? `<mpns><mpn>${escapeXml(mpn)}</mpn></mpns>` : ""}
            <skus><sku>${escapeXml(sku)}</sku></skus>
            <brands><brand>${escapeXml(brand)}</brand></brands>
          </product_ids>
          <product_name><![CDATA[${escapeXml(productName)}]]></product_name>
          <product_url><![CDATA[${productUrl}]]></product_url>
        </product>
      </products>
      <is_spam>false</is_spam>
      <collection_method>${collectionMethod}</collection_method>
      ${review.orderId ? `<transaction_id><![CDATA[${review.orderId}]]></transaction_id>` : ""}
      <reviewer_type>${review.verificationStatus === "verified_purchase" ? "verified_buyer" : "anonymous"}</reviewer_type>
    </review>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:vc="http://www.w3.org/2007/XMLSchema-versioning"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:noNamespaceSchemaLocation="http://www.google.com/shopping/reviews/schema/product/2.3/product_reviews.xsd">
  <version>2.3</version>
  <aggregator>
    <name>${escapeXml(PUBLISHER_NAME)}</name>
  </aggregator>
  <publisher>
    <name>${escapeXml(PUBLISHER_NAME)}</name>
    <favicon>${PUBLISHER_URL}/favicon.ico</favicon>
    <link rel="canonical" href="${PUBLISHER_URL}" />\n  </publisher>
  <reviews>
${reviewNodes}
  </reviews>
</feed>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
