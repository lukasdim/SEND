import { useEffect } from "react";

export type SeoMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  imagePath: string;
  ogType: "website" | "article";
  noindex?: boolean;
};

export const DEFAULT_SITE_URL = "https://sendsys.io";
export const DEFAULT_SEO_IMAGE_PATH = "/landing-sandbox-hero.webp";
export const DEFAULT_SITE_DESCRIPTION =
  "SEND is a financial education platform where you learn trading logic through guided lessons, visual strategy graphs, and a sandbox built on historical market data.";

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

function getSiteBaseUrl(): string {
  const envSiteUrl = import.meta.env.VITE_SITE_URL?.trim() ?? "";
  if (envSiteUrl) {
    return normalizeBaseUrl(envSiteUrl);
  }

  if (typeof window !== "undefined" && window.location.origin) {
    return normalizeBaseUrl(window.location.origin);
  }

  return normalizeBaseUrl(DEFAULT_SITE_URL);
}

function toAbsoluteUrl(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) {
    return getSiteBaseUrl();
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return new URL(normalizedPath, getSiteBaseUrl()).toString();
  }
}

function ensureMetaTag(attribute: "name" | "property", value: string): HTMLMetaElement {
  const selector = `meta[${attribute}="${value}"]`;
  const existingTag = document.head.querySelector<HTMLMetaElement>(selector);
  if (existingTag) {
    return existingTag;
  }

  const tag = document.createElement("meta");
  tag.setAttribute(attribute, value);
  document.head.appendChild(tag);
  return tag;
}

function ensureLinkTag(rel: string): HTMLLinkElement {
  const selector = `link[rel="${rel}"]`;
  const existingTag = document.head.querySelector<HTMLLinkElement>(selector);
  if (existingTag) {
    return existingTag;
  }

  const tag = document.createElement("link");
  tag.setAttribute("rel", rel);
  document.head.appendChild(tag);
  return tag;
}

export function applySeoMeta(meta: SeoMeta): void {
  const canonicalUrl = toAbsoluteUrl(meta.canonicalPath);
  const imageUrl = toAbsoluteUrl(meta.imagePath);
  const robotsValue = meta.noindex ? "noindex, nofollow" : "index, follow";

  document.title = meta.title;

  ensureMetaTag("name", "description").setAttribute("content", meta.description);
  ensureMetaTag("name", "robots").setAttribute("content", robotsValue);

  ensureLinkTag("canonical").setAttribute("href", canonicalUrl);

  ensureMetaTag("property", "og:title").setAttribute("content", meta.title);
  ensureMetaTag("property", "og:description").setAttribute("content", meta.description);
  ensureMetaTag("property", "og:type").setAttribute("content", meta.ogType);
  ensureMetaTag("property", "og:url").setAttribute("content", canonicalUrl);
  ensureMetaTag("property", "og:image").setAttribute("content", imageUrl);

  ensureMetaTag("name", "twitter:card").setAttribute("content", "summary_large_image");
  ensureMetaTag("name", "twitter:title").setAttribute("content", meta.title);
  ensureMetaTag("name", "twitter:description").setAttribute("content", meta.description);
  ensureMetaTag("name", "twitter:image").setAttribute("content", imageUrl);
}

export function useSeoMeta(meta: SeoMeta | null | undefined): void {
  const title = meta?.title;
  const description = meta?.description;
  const canonicalPath = meta?.canonicalPath;
  const imagePath = meta?.imagePath;
  const ogType = meta?.ogType;
  const noindex = meta?.noindex;

  useEffect(() => {
    if (!title || !description || !canonicalPath || !imagePath || !ogType) {
      return;
    }

    applySeoMeta({
      title,
      description,
      canonicalPath,
      imagePath,
      ogType,
      noindex,
    });
  }, [canonicalPath, description, imagePath, noindex, ogType, title]);
}
