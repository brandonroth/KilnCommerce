"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoRefreshToken,
  type CognitoUserSession,
} from "amazon-cognito-identity-js";

// ── Types ──────────────────────────────────────────────────────────────────

type View = "login" | "new-password" | "authenticated";

interface TableResult {
  items: Record<string, unknown>[];
  lastKey?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TABLES = ["products", "orders", "checkouts", "inquiries", "subscriptions"] as const;
type TableName = typeof TABLES[number];
type ActiveTab = TableName | "settings";

// ── Settings metadata ──────────────────────────────────────────────────────

interface SettingMeta {
  label: string;
  hint?: string;
  type?: "text" | "email" | "url" | "number";
  multiline?: boolean;
}

const SETTING_META: Record<string, SettingMeta> = {
  "store.name":              { label: "Store Name",            hint: "Displayed in outbound emails" },
  "store.signature":         { label: "Email Signature",       hint: "Sign-off line in outbound emails (e.g. — b ✌️)" },
  "store.email":             { label: "Contact Email",         hint: "Shown on the contact page", type: "email" },
  "store.location":          { label: "Studio Location",       hint: "Shown on the contact page" },
  "store.social.instagram":  { label: "Instagram URL",         hint: "Leave blank to hide", type: "url" },
  "store.social.tiktok":     { label: "TikTok URL",            hint: "Leave blank to hide", type: "url" },
  "store.social.etsy":       { label: "Etsy URL",              hint: "Leave blank to hide", type: "url" },
  "tax.rate":                { label: "Tax Rate (%)",          hint: "Flat % override (e.g. 8.25). Leave blank to use the Utah component rates (7.45%)", type: "number" },
  "email.welcome.subject":   { label: "Welcome Email Subject", hint: "Subject line of the newsletter sign-up confirmation email" },
  "email.welcome.body":      { label: "Welcome Email Body",    hint: "Body copy above the signature. The store name and signature are appended automatically.", multiline: true },
};

const API_URL = process.env.SITE_API_URL ?? "";

// ── Cognito helpers ────────────────────────────────────────────────────────

function getPool(): CognitoUserPool {
  return new CognitoUserPool({
    UserPoolId: process.env.COGNITO_USER_POOL_ID!,
    ClientId: process.env.COGNITO_CLIENT_ID!,
  });
}

function saveSession(session: CognitoUserSession, username: string): void {
  sessionStorage.setItem("admin_id_token", session.getIdToken().getJwtToken());
  sessionStorage.setItem("admin_refresh_token", session.getRefreshToken().getToken());
  sessionStorage.setItem("admin_username", username);
}

function clearSession(): void {
  sessionStorage.removeItem("admin_id_token");
  sessionStorage.removeItem("admin_refresh_token");
  sessionStorage.removeItem("admin_username");
}

function getIdToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("admin_id_token");
}

function isExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1])) as { exp: number };
    return Date.now() / 1000 > payload.exp - 30;
  } catch {
    return true;
  }
}

function refreshIdToken(): Promise<string | null> {
  const storedRefresh = sessionStorage.getItem("admin_refresh_token");
  const username = sessionStorage.getItem("admin_username");
  if (!storedRefresh || !username) return Promise.resolve(null);

  return new Promise((resolve) => {
    const user = new CognitoUser({ Username: username, Pool: getPool() });
    user.refreshSession(
      new CognitoRefreshToken({ RefreshToken: storedRefresh }),
      (err, session: CognitoUserSession) => {
        if (err) { resolve(null); return; }
        const newToken = session.getIdToken().getJwtToken();
        sessionStorage.setItem("admin_id_token", newToken);
        resolve(newToken);
      }
    );
  });
}

/** Returns a valid idToken, refreshing silently if needed. Throws if unable. */
async function validToken(): Promise<string> {
  let token = getIdToken();
  if (!token || isExpired(token)) token = await refreshIdToken();
  if (!token) throw new Error("unauthenticated");
  return token;
}

// ── LoginForm ─────────────────────────────────────────────────────────────

interface LoginFormProps {
  onSuccess: () => void;
  onNewPasswordRequired: (user: CognitoUser) => void;
}

function LoginForm({ onSuccess, onNewPasswordRequired }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const user = new CognitoUser({ Username: email, Pool: getPool() });
    const authDetails = new AuthenticationDetails({ Username: email, Password: password });

    user.authenticateUser(authDetails, {
      onSuccess(session) {
        saveSession(session, email);
        setLoading(false);
        onSuccess();
      },
      onFailure(err: { message?: string }) {
        setError(err.message ?? "Authentication failed");
        setLoading(false);
      },
      newPasswordRequired() {
        setLoading(false);
        onNewPasswordRequired(user);
      },
    });
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-8 pt-24">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-bold lowercase mb-1">admin</h1>
        <p className="text-sm text-text-light mb-8">sign in to view store data</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
              email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="py-3 px-4 border border-[rgba(26,26,24,0.1)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
              password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="py-3 px-4 border border-[rgba(26,26,24,0.1)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-3.5 px-9 bg-[#1A1A18] text-cream rounded font-body text-[0.82rem] tracking-wider lowercase font-medium transition-all hover:bg-[#2A2A26] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "signing in..." : "sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── NewPasswordForm ───────────────────────────────────────────────────────

interface NewPasswordFormProps {
  user: CognitoUser;
  onSuccess: () => void;
}

function NewPasswordForm({ user, onSuccess }: NewPasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    setError(null);

    user.completeNewPasswordChallenge(password, {}, {
      onSuccess(session) {
        saveSession(session, user.getUsername());
        setLoading(false);
        onSuccess();
      },
      onFailure(err: { message?: string }) {
        setError(err.message ?? "Failed to set password");
        setLoading(false);
      },
    });
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-8 pt-24">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-bold lowercase mb-1">set password</h1>
        <p className="text-sm text-text-light mb-8">choose a permanent password for your account</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <label className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
              new password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={12}
              autoComplete="new-password"
              className="py-3 px-4 border border-[rgba(26,26,24,0.1)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
              confirm
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="py-3 px-4 border border-[rgba(26,26,24,0.1)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="py-3.5 px-9 bg-[#1A1A18] text-cream rounded font-body text-[0.82rem] tracking-wider lowercase font-medium transition-all hover:bg-[#2A2A26] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "saving..." : "set password"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Image processing ──────────────────────────────────────────────────────

/**
 * Resizes an image file to fit within 800×800 and encodes it as WebP (quality 0.8).
 * Uses the Canvas API — zero dependencies, no server round-trip before upload.
 *
 * Modern browsers apply EXIF orientation when rendering <img>, so drawing to a
 * canvas automatically produces correctly-rotated pixels.
 *
 * HEIC files are supported on iOS (OS converts to JPEG before the browser sees
 * the bytes) and on macOS Safari. Chrome/Firefox on desktop will throw — users
 * should convert HEIC files or use Safari in that case.
 */
async function resizeToWebP(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`Cannot decode "${file.name}" — try JPEG or PNG, or use Safari for HEIC`));
      el.src = url;
    });

    const MAX = 800;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > MAX || h > MAX) {
      if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
      else        { w = Math.round(w * MAX / h); h = MAX; }
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Canvas export failed")),
        "image/webp",
        0.8,
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── DataView ──────────────────────────────────────────────────────────────

interface DataViewProps {
  onSignOut: () => void;
}

interface ShipFormState {
  orderId: string;
  carrier: "ups" | "usps";
  service: string;
  trackingNumber: string;
  cost: string;
  loading: boolean;
  error: string | null;
}

interface UploadedImage {
  id: string;
  filename: string;
  key: string;
  uploading: boolean;
  error: string | null;
}

interface OrderNotesState {
  orderId: string;
  draft: string;
  saving: boolean;
  error: string | null;
}

interface ProductFilter {
  search: string;
  status: "all" | "available" | "sold";
  sort: "newest" | "name" | "price";
}

/** Unified state for both create (slug=null) and edit (slug=string) product forms. */
interface ProductFormState {
  slug: string | null;
  name: string;
  price: string;
  tagline: string;
  description: string;
  badge: string;
  tags: string;           // comma-separated, split on save
  details: { key: string; value: string }[];
  weight: string;
  length: string;
  width: string;
  height: string;
  images: string[];            // confirmed S3 keys
  pendingImages: UploadedImage[];
  saving: boolean;
  error: string | null;
}

// ── Product form helpers ───────────────────────────────────────────────────

function itemToForm(item: Record<string, unknown>, slug: string): ProductFormState {
  const rawDetails = (item.details ?? {}) as Record<string, string>;
  return {
    slug,
    name: String(item.name ?? ""),
    price: String(item.price ?? ""),
    tagline: String(item.tagline ?? ""),
    description: String(item.description ?? ""),
    badge: String(item.badge ?? ""),
    tags: Array.isArray(item.tags) ? (item.tags as string[]).join(", ") : "",
    details: Object.entries(rawDetails).map(([key, value]) => ({ key, value })),
    weight: String(item.weight ?? ""),
    length: String(item.length ?? ""),
    width: String(item.width ?? ""),
    height: String(item.height ?? ""),
    images: Array.isArray(item.images) ? (item.images as string[]) : [],
    pendingImages: [],
    saving: false,
    error: null,
  };
}

function emptyForm(): ProductFormState {
  return {
    slug: null,
    name: "", price: "", tagline: "", description: "", badge: "",
    tags: "", details: [], weight: "", length: "", width: "", height: "",
    images: [], pendingImages: [], saving: false, error: null,
  };
}

function formToPayload(form: ProductFormState): Record<string, unknown> {
  const details = Object.fromEntries(
    form.details.filter((d) => d.key.trim()).map((d) => [d.key.trim(), d.value.trim()])
  );
  const allImages = [
    ...form.images,
    ...form.pendingImages.filter((img) => img.key && !img.uploading).map((img) => img.key),
  ];
  return {
    name: form.name.trim(),
    price: parseFloat(form.price) || 0,
    tagline: form.tagline.trim(),
    description: form.description.trim(),
    badge: form.badge.trim(),
    tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    details,
    weight: parseFloat(form.weight) || 0,
    length: parseFloat(form.length) || 0,
    width: parseFloat(form.width) || 0,
    height: parseFloat(form.height) || 0,
    images: allImages,
  };
}

// ── CSS class constants ────────────────────────────────────────────────────

/**
 * Format a Stripe shipping_details object into address lines.
 * Structure: { name, address: { line1, line2, city, state, postal_code, country } }
 */
function formatShipTo(shipping: Record<string, unknown>): string[] {
  const addr = typeof shipping.address === "object" && shipping.address !== null
    ? shipping.address as Record<string, unknown>
    : {};
  return [
    shipping.name,
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country && addr.country !== "US" ? addr.country : null,
  ].filter(Boolean).map(String).filter((s) => s.length > 0);
}

/** Format an ISO timestamp to a short date string, e.g. "2024-03-15" */
function fmtDate(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  return iso.slice(0, 10);
}

const labelCls = "text-[0.62rem] tracking-widest uppercase text-text-light font-medium";
const inputCls = "py-2 px-3 border border-[rgba(26,26,24,0.15)] rounded font-body text-sm bg-cream outline-none focus:border-orange transition-colors";
const submitBtnCls = "py-2 px-5 bg-[#1A1A18] text-cream rounded font-body text-[0.78rem] tracking-wider lowercase font-medium transition-all hover:bg-[#2A2A26] disabled:opacity-50 disabled:cursor-not-allowed";

// ── ProductFormBody ────────────────────────────────────────────────────────
// Defined at module level so React never sees a new component type on re-render,
// which would unmount inputs and cause focus loss on every keystroke.

interface ProductFormBodyProps {
  form: ProductFormState;
  setForm: React.Dispatch<React.SetStateAction<ProductFormState | null>>;
  uploadImage: (file: File) => Promise<void>;
}

function ProductFormBody({ form, setForm, uploadImage }: ProductFormBodyProps) {
  return (
    <>
      {/* Name / Price / Badge */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className={labelCls}>name</label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} required className={inputCls} />
        </div>
        <div className="flex flex-col gap-1 w-28">
          <label className={labelCls}>price ($)</label>
          <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => f && { ...f, price: e.target.value })} required className={inputCls} />
        </div>
        <div className="flex flex-col gap-1 w-36">
          <label className={labelCls}>badge</label>
          <input type="text" value={form.badge} onChange={(e) => setForm((f) => f && { ...f, badge: e.target.value })} placeholder="new, fan fav…" className={inputCls} />
        </div>
      </div>

      {/* Tagline */}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>tagline</label>
        <input type="text" value={form.tagline} onChange={(e) => setForm((f) => f && { ...f, tagline: e.target.value })} className={inputCls} />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>description</label>
        <textarea value={form.description} onChange={(e) => setForm((f) => f && { ...f, description: e.target.value })} rows={3} className={`${inputCls} resize-y leading-relaxed`} />
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1">
        <label className={labelCls}>tags <span className="normal-case tracking-normal font-normal text-text-light">(comma-separated)</span></label>
        <input type="text" value={form.tags} onChange={(e) => setForm((f) => f && { ...f, tags: e.target.value })} placeholder="honey, raw, gift…" className={inputCls} />
      </div>

      {/* Shipping dimensions */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1 w-28">
          <label className={labelCls}>weight (oz)</label>
          <input type="number" step="0.01" min="0" value={form.weight} onChange={(e) => setForm((f) => f && { ...f, weight: e.target.value })} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1 w-28">
          <label className={labelCls}>length (in)</label>
          <input type="number" step="0.01" min="0" value={form.length} onChange={(e) => setForm((f) => f && { ...f, length: e.target.value })} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1 w-28">
          <label className={labelCls}>width (in)</label>
          <input type="number" step="0.01" min="0" value={form.width} onChange={(e) => setForm((f) => f && { ...f, width: e.target.value })} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1 w-28">
          <label className={labelCls}>height (in)</label>
          <input type="number" step="0.01" min="0" value={form.height} onChange={(e) => setForm((f) => f && { ...f, height: e.target.value })} className={inputCls} />
        </div>
      </div>

      {/* Details key/value pairs */}
      <div className="flex flex-col gap-2">
        <span className={labelCls}>details</span>
        {form.details.map((d, idx) => (
          <div key={idx} className="flex gap-2 items-center">
            <input
              type="text"
              value={d.key}
              onChange={(e) => setForm((f) => f && { ...f, details: f.details.map((row, ri) => ri === idx ? { ...row, key: e.target.value } : row) })}
              placeholder="key"
              className={`${inputCls} w-36`}
            />
            <input
              type="text"
              value={d.value}
              onChange={(e) => setForm((f) => f && { ...f, details: f.details.map((row, ri) => ri === idx ? { ...row, value: e.target.value } : row) })}
              placeholder="value"
              className={`${inputCls} flex-1`}
            />
            <button type="button" onClick={() => setForm((f) => f && { ...f, details: f.details.filter((_, ri) => ri !== idx) })} className="text-sm text-text-light hover:text-red-600 transition-colors px-1" aria-label="remove detail">×</button>
          </div>
        ))}
        <button type="button" onClick={() => setForm((f) => f && { ...f, details: [...f.details, { key: "", value: "" }] })} className="self-start text-[0.72rem] text-orange underline underline-offset-2 hover:opacity-70 transition-opacity">+ add detail</button>
      </div>

      {/* Images */}
      <div className="flex flex-col gap-2">
        <span className={labelCls}>images</span>
        <div className="flex flex-wrap gap-2 items-center">
          {form.images.map((img, idx) => (
            <div key={idx} className="flex items-center gap-1 py-1.5 px-3 border border-[rgba(26,26,24,0.1)] rounded text-[0.72rem] font-mono bg-[rgba(26,26,24,0.02)]">
              <span>{img}</span>
              <button type="button" onClick={() => setForm((f) => f && { ...f, images: f.images.filter((_, i) => i !== idx) })} className="ml-1 text-text-light hover:text-red-600 transition-colors" aria-label="remove image">×</button>
            </div>
          ))}
          {form.pendingImages.map((img) => (
            <div key={img.id} className="flex items-center gap-1 py-1.5 px-3 border border-[rgba(26,26,24,0.1)] rounded text-[0.72rem] font-mono">
              {img.uploading ? <span className="text-text-light">uploading {img.filename}…</span>
                : img.error ? <span className="text-red-600">{img.filename}: {img.error}</span>
                : <span>{img.key}</span>}
              {!img.uploading && (
                <button type="button" onClick={() => setForm((f) => f && { ...f, pendingImages: f.pendingImages.filter((p) => p.id !== img.id) })} className="ml-1 text-text-light hover:text-red-600 transition-colors" aria-label="remove pending image">×</button>
              )}
            </div>
          ))}
          <label className="cursor-pointer py-1.5 px-3 border border-[rgba(26,26,24,0.15)] rounded text-[0.72rem] font-medium text-text-light hover:border-orange hover:text-orange transition-colors">
            + pick files
            <input type="file" accept="image/*,.heic,.heif" multiple className="sr-only" onChange={(e) => { Array.from(e.target.files ?? []).forEach((f) => uploadImage(f)); e.target.value = ""; }} />
          </label>
        </div>
      </div>
    </>
  );
}

function DataView({ onSignOut }: DataViewProps) {
  const [activeTable, setActiveTable] = useState<ActiveTab>("products");
  const [data, setData] = useState<TableResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingForm, setShippingForm] = useState<ShipFormState | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [orderNotes, setOrderNotes] = useState<OrderNotesState | null>(null);
  const [productFilter, setProductFilter] = useState<ProductFilter>({ search: "", status: "all", sort: "newest" });
  const [expandedProductSlug, setExpandedProductSlug] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // ── Settings tab state ────────────────────────────────────────────────────
  const [settingsData, setSettingsData] = useState<Record<string, string> | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  /** Per-key save state: key → { draft, saving, error, saved } */
  const [settingsDrafts, setSettingsDrafts] = useState<Record<string, string>>({});
  const [settingsSaving, setSettingsSaving] = useState<Record<string, boolean>>({});
  const [settingsSaveError, setSettingsSaveError] = useState<Record<string, string | null>>({});

  // Keep onSignOut ref up-to-date so fetchTable closure never goes stale
  const onSignOutRef = useRef(onSignOut);
  onSignOutRef.current = onSignOut;

  // Keep productFilter ref current so fetchTable (with [] deps) can read it without going stale.
  // Status is also passed explicitly when changed so we don't depend on batched state update timing.
  const productFilterRef = useRef(productFilter);
  productFilterRef.current = productFilter;

  const fetchTable = useCallback(async (
    table: ActiveTab,
    lastKey?: string,
    statusOverride?: "all" | "available" | "sold",
  ) => {
    setLoading(true);
    if (!lastKey) setData(null);
    setError(null);

    try {
      const token = await validToken();
      const params = new URLSearchParams();
      if (lastKey) params.set("lastKey", lastKey);
      const status = statusOverride ?? productFilterRef.current.status;
      if (table === "products" && status !== "all") params.set("status", status);
      const qs = params.toString();
      const url = qs ? `${API_URL}/admin/${table}?${qs}` : `${API_URL}/admin/${table}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (res.status === 401) {
        clearSession();
        onSignOutRef.current();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json() as TableResult;

      setData((prev) =>
        lastKey && prev
          ? { items: [...prev.items, ...result.items], lastKey: result.lastKey }
          : result
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "unauthenticated") {
        clearSession();
        onSignOutRef.current();
        return;
      }
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []); // onSignOut accessed via ref — no dep needed

  async function fetchSettings(): Promise<void> {
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const token = await validToken();
      const res = await fetch(`${API_URL}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { clearSession(); onSignOutRef.current(); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json() as Record<string, string>;
      setSettingsData(result);
      setSettingsDrafts(result);
    } catch {
      setSettingsError("Failed to load settings");
    } finally {
      setSettingsLoading(false);
    }
  }

  async function saveSetting(key: string): Promise<void> {
    setSettingsSaving((s) => ({ ...s, [key]: true }));
    setSettingsSaveError((s) => ({ ...s, [key]: null }));
    try {
      const token = await validToken();
      const res = await fetch(`${API_URL}/admin/settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value: settingsDrafts[key] ?? "" }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setSettingsData((d) => d ? { ...d, [key]: settingsDrafts[key] ?? "" } : d);
    } catch (err: unknown) {
      setSettingsSaveError((s) => ({ ...s, [key]: err instanceof Error ? err.message : "Save failed" }));
    } finally {
      setSettingsSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function submitShipping(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingForm) return;
    setShippingForm((f) => f && { ...f, loading: true, error: null });

    try {
      const token = await validToken();
      const res = await fetch(`${API_URL}/admin/orders/${shippingForm.orderId}/shipping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
            carrier: shippingForm.carrier,
            service: shippingForm.service,
            trackingNumber: shippingForm.trackingNumber,
            cost: parseFloat(shippingForm.cost),
          }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setShippingForm(null);
      // Refresh the orders table so shipping info is visible
      await fetchTable("orders");
    } catch (err: unknown) {
      setShippingForm((f) => f && { ...f, loading: false, error: err instanceof Error ? err.message : "Failed" });
    }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!productForm) return;
    setProductForm((f) => f && { ...f, saving: true, error: null });

    const payload = formToPayload(productForm);

    try {
      const token = await validToken();
      const res = productForm.slug
        ? await fetch(`${API_URL}/admin/products/${productForm.slug}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_URL}/admin/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setProductForm(null);
      await fetchTable("products");
    } catch (err: unknown) {
      setProductForm((f) => f && { ...f, saving: false, error: err instanceof Error ? err.message : "Save failed" });
    }
  }

  async function uploadImage(file: File): Promise<void> {
    const id = Math.random().toString(36).slice(2);
    setProductForm((f) => f && {
      ...f,
      pendingImages: [...f.pendingImages, { id, filename: file.name, key: "", uploading: true, error: null }],
    });
    try {
      const token = await validToken();
      const processed = await resizeToWebP(file);
      const res = await fetch(`${API_URL}/admin/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "image/webp", Authorization: `Bearer ${token}` },
        body: processed,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { key } = await res.json() as { key: string };
      setProductForm((f) => f && {
        ...f,
        pendingImages: f.pendingImages.map((img) => img.id === id ? { ...img, key, uploading: false } : img),
      });
    } catch (err) {
      setProductForm((f) => f && {
        ...f,
        pendingImages: f.pendingImages.map((img) =>
          img.id === id ? { ...img, uploading: false, error: err instanceof Error ? err.message : "Upload failed" } : img
        ),
      });
    }
  }

  async function saveOrderNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!orderNotes) return;
    setOrderNotes((n) => n && { ...n, saving: true, error: null });
    try {
      const token = await validToken();
      const res = await fetch(`${API_URL}/admin/orders/${orderNotes.orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: orderNotes.draft }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setOrderNotes(null);
      await fetchTable("orders");
    } catch (err: unknown) {
      setOrderNotes((n) => n && { ...n, saving: false, error: err instanceof Error ? err.message : "Save failed" });
    }
  }

  // Fetch whenever the active tab changes (including initial mount); reset product filter on switch.
  // Pass statusOverride "all" explicitly — setProductFilter is batched so the ref won't update yet.
  useEffect(() => {
    if (activeTable === "settings") {
      void fetchSettings();
      return;
    }
    setProductFilter({ search: "", status: "all", sort: "newest" });
    setExpandedProductSlug(null);
    setExpandedOrderId(null);
    fetchTable(activeTable, undefined, "all");
  }, [activeTable, fetchTable]);

  // Derive columns from ALL items (unfiltered) so columns don't disappear when filtering
  const columns = data?.items.length
    ? Array.from(new Set(data.items.flatMap((item) => Object.keys(item))))
    : [];

  // Client-side search + sort for the products tab (status is filtered server-side)
  const displayItems = (() => {
    if (!data) return [];
    if (activeTable !== "products") return data.items;
    let items = data.items;
    if (productFilter.search.trim()) {
      const q = productFilter.search.toLowerCase();
      items = items.filter((i) =>
        String(i.name ?? "").toLowerCase().includes(q) ||
        String(i.tagline ?? "").toLowerCase().includes(q) ||
        String(i.badge ?? "").toLowerCase().includes(q)
      );
    }
    if (productFilter.sort === "name") return [...items].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
    if (productFilter.sort === "price") return [...items].sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0));
    // newest: createdAt descending
    return [...items].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  })();

  function renderCell(value: unknown): React.ReactNode {
    if (value === null || value === undefined) return null;

    // Order items: [{slug, name, price}] — render as linked list
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === "object" &&
      value[0] !== null &&
      "slug" in (value[0] as Record<string, unknown>) &&
      "name" in (value[0] as Record<string, unknown>)
    ) {
      const items = value as Array<{ slug?: string; name?: string; price?: number }>;
      return (
        <div className="flex flex-col gap-1.5">
          {items.map((itm, idx) => (
            <div key={idx} className="flex items-baseline gap-2">
              <a
                href={`/shop/${itm.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-[0.72rem] text-orange underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                {itm.name ?? itm.slug}
              </a>
              {itm.price !== undefined && (
                <span className="text-[0.72rem] text-text-light">${itm.price}</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(value) && value.every((v) => typeof v === "string" && v.startsWith("/images/"))) {
      return (
        <div className="flex flex-col gap-1">
          {(value as string[]).map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer"
              className="text-[0.72rem] font-mono text-orange underline underline-offset-2 break-all hover:opacity-70">
              {src}
            </a>
          ))}
        </div>
      );
    }
    if (typeof value === "object") {
      return (
        <pre className="text-[0.72rem] whitespace-pre-wrap break-words leading-relaxed">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return String(value);
  }


  return (
    <div className="pt-32 pb-12 px-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl font-bold lowercase">admin</h1>
          <button
            onClick={onSignOut}
            className="text-sm text-text-light underline underline-offset-2 hover:text-orange transition-colors"
          >
            sign out
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-[rgba(26,26,24,0.1)] flex-wrap">
          {TABLES.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTable(tab)}
              className={`pb-3 px-4 text-sm font-medium lowercase transition-colors border-b-2 -mb-px ${
                activeTable === tab
                  ? "border-orange text-orange"
                  : "border-transparent text-text-light hover:text-[#1A1A18]"
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setActiveTable("settings")}
            className={`pb-3 px-4 text-sm font-medium lowercase transition-colors border-b-2 -mb-px ml-auto ${
              activeTable === "settings"
                ? "border-orange text-orange"
                : "border-transparent text-text-light hover:text-[#1A1A18]"
            }`}
          >
            settings
          </button>
        </div>

        {/* Settings panel */}
        {activeTable === "settings" && (
          <div>
            {settingsLoading && <p className="text-sm text-text-light py-8">loading...</p>}
            {settingsError && (
              <div className="py-8">
                <p className="text-sm text-red-600 mb-3">{settingsError}</p>
                <button onClick={() => void fetchSettings()} className="text-sm text-orange underline underline-offset-2">retry</button>
              </div>
            )}
            {settingsData && !settingsError && (
              <div className="flex flex-col gap-0 divide-y divide-[rgba(26,26,24,0.08)]">
                {Object.entries(SETTING_META).map(([key, meta]) => {
                  const saved   = settingsData[key] ?? "";
                  const draft   = settingsDrafts[key] ?? saved;
                  const saving  = settingsSaving[key] ?? false;
                  const saveErr = settingsSaveError[key] ?? null;
                  const dirty   = draft !== saved;
                  return (
                    <div key={key} className="py-5 flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-6">
                      <div className="sm:w-52 flex-shrink-0">
                        <p className={labelCls}>{meta.label}</p>
                        {meta.hint && <p className="text-[0.68rem] text-text-light mt-0.5 leading-snug">{meta.hint}</p>}
                      </div>
                      <div className="flex flex-1 flex-col gap-1.5">
                        <div className={`flex gap-2 ${meta.multiline ? "items-end" : ""}`}>
                          {meta.multiline ? (
                            <textarea
                              value={draft}
                              onChange={(e) => setSettingsDrafts((d) => ({ ...d, [key]: e.target.value }))}
                              rows={4}
                              className={`${inputCls} flex-1 min-w-0 resize-y leading-relaxed`}
                              placeholder="(default)"
                            />
                          ) : (
                            <input
                              type={meta.type ?? "text"}
                              value={draft}
                              onChange={(e) => setSettingsDrafts((d) => ({ ...d, [key]: e.target.value }))}
                              className={`${inputCls} flex-1 min-w-0`}
                              placeholder="(default)"
                            />
                          )}
                          <button
                            onClick={() => void saveSetting(key)}
                            disabled={saving || !dirty}
                            className={submitBtnCls}
                          >
                            {saving ? "saving…" : "save"}
                          </button>
                        </div>
                        {saveErr && <p className="text-xs text-red-600">{saveErr}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Table content (hidden when settings tab is active) */}
        {activeTable !== "settings" && loading && !data && (
          <p className="text-sm text-text-light py-8">loading...</p>
        )}

        {activeTable !== "settings" && error && (
          <div className="py-8">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={() => fetchTable(activeTable)}
              className="text-sm text-orange underline underline-offset-2"
            >
              retry
            </button>
          </div>
        )}

        {activeTable !== "settings" && data && !error && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[0.72rem] text-text-light uppercase tracking-widest">
                {data.items.length} item{data.items.length !== 1 ? "s" : ""}
                {data.lastKey ? " (more available)" : ""}
              </p>
              {activeTable === "products" && (
                <button
                  onClick={() => setProductForm(productForm?.slug === null ? null : emptyForm())}
                  className="text-[0.72rem] text-orange underline underline-offset-2 hover:opacity-70 transition-opacity"
                >
                  {productForm?.slug === null ? "cancel" : "+ add product"}
                </button>
              )}
            </div>

            {/* Products filter bar */}
            {activeTable === "products" && (
              <div className="flex flex-wrap gap-3 items-center mb-5">
                <input
                  type="search"
                  placeholder="search name, tagline…"
                  value={productFilter.search}
                  onChange={(e) => setProductFilter((f) => ({ ...f, search: e.target.value }))}
                  className={`${inputCls} w-52`}
                />
                <div className="flex gap-1">
                  {(["all", "available", "sold"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setProductFilter((f) => ({ ...f, status: s }));
                        void fetchTable("products", undefined, s);
                      }}
                      className={`py-1.5 px-3 rounded text-[0.65rem] tracking-widest uppercase font-medium transition-colors ${
                        productFilter.status === s
                          ? "bg-[#1A1A18] text-cream"
                          : "border border-[rgba(26,26,24,0.15)] text-text-light hover:border-orange hover:text-orange"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <select
                  value={productFilter.sort}
                  onChange={(e) => setProductFilter((f) => ({ ...f, sort: e.target.value as ProductFilter["sort"] }))}
                  className={`${inputCls} text-[0.72rem]`}
                >
                  <option value="newest">newest first</option>
                  <option value="name">a → z</option>
                  <option value="price">price ↑</option>
                </select>
                {productFilter.search.trim() && displayItems.length !== data.items.length && (
                  <span className="text-[0.68rem] text-text-light">
                    showing {displayItems.length} of {data.items.length} loaded
                  </span>
                )}
              </div>
            )}

            {/* Add product panel */}
            {productForm?.slug === null && activeTable === "products" && (
              <div className="mb-6 border border-[rgba(26,26,24,0.1)] rounded p-6 bg-[rgba(26,26,24,0.01)]">
                <form onSubmit={saveProduct} className="flex flex-col gap-5">
                  <p className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">new product</p>
                  <ProductFormBody form={productForm!} setForm={setProductForm} uploadImage={uploadImage} />
                  <div className="flex items-center gap-4 pt-2">
                    <button
                      type="submit"
                      disabled={productForm.saving || productForm.pendingImages.some((i) => i.uploading)}
                      className={submitBtnCls}
                    >
                      {productForm.saving ? "creating…" : productForm.pendingImages.some((i) => i.uploading) ? "uploading…" : "create product"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductForm(null)}
                      className="text-sm text-text-light underline underline-offset-2"
                    >
                      cancel
                    </button>
                    {productForm.error && <p className="text-sm text-red-600">{productForm.error}</p>}
                  </div>
                </form>
              </div>
            )}

            {data.items.length === 0 ? (
              <p className="text-sm text-text-light py-4">no records</p>
            ) : displayItems.length === 0 ? (
              <p className="text-sm text-text-light py-4">no products match your filter</p>
            ) : activeTable === "products" ? (

              /* ── Compact products table ─────────────────────────────────── */
              <div className="rounded border border-[rgba(26,26,24,0.1)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(26,26,24,0.1)] bg-[rgba(26,26,24,0.03)]">
                      <th className="py-3 px-3 w-14" />
                      {["name","price","status","badge","created"].map((h) => (
                        <th key={h} className="text-left py-3 px-3 text-[0.65rem] tracking-widest uppercase text-text-light font-medium whitespace-nowrap">{h}</th>
                      ))}
                      <th className="text-left py-3 px-3 text-[0.65rem] tracking-widest uppercase text-text-light font-medium whitespace-nowrap">actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((item) => {
                      const slug = item.slug as string;
                      const images = Array.isArray(item.images) ? item.images as string[] : [];
                      const thumb = images[0];
                      const status = item.orderId ? "sold" : "available";
                      const isExpanded = expandedProductSlug === slug;
                      const isEditing = productForm?.slug === slug;

                      return (
                        <>
                          <tr key={slug} className="border-b border-[rgba(26,26,24,0.06)] hover:bg-[rgba(26,26,24,0.02)] transition-colors">
                            {/* Thumbnail */}
                            <td className="py-2 px-3 align-middle">
                              {thumb
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={thumb} alt="" className="w-10 h-10 object-cover rounded" />
                                : <div className="w-10 h-10 rounded bg-[rgba(26,26,24,0.06)]" />
                              }
                            </td>
                            {/* Name */}
                            <td className="py-3 px-3 align-middle font-medium text-[0.85rem] max-w-[200px]">{String(item.name ?? "")}</td>
                            {/* Price */}
                            <td className="py-3 px-3 align-middle text-[0.82rem] whitespace-nowrap">${String(item.price ?? "")}</td>
                            {/* Status */}
                            <td className="py-3 px-3 align-middle whitespace-nowrap">
                              <span className={`text-[0.62rem] tracking-widest uppercase font-medium ${status === "sold" ? "text-text-light" : "text-orange"}`}>
                                {status}
                              </span>
                            </td>
                            {/* Badge */}
                            <td className="py-3 px-3 align-middle text-[0.78rem] text-text-light whitespace-nowrap">{String(item.badge ?? "")}</td>
                            {/* Created */}
                            <td className="py-3 px-3 align-middle text-[0.78rem] text-text-light whitespace-nowrap">{fmtDate(item.createdAt)}</td>
                            {/* Actions */}
                            <td className="py-3 px-3 align-middle">
                              <div className="flex flex-col gap-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setExpandedProductSlug(isExpanded ? null : slug);
                                    if (isEditing) setProductForm(null);
                                  }}
                                  className="text-[0.72rem] text-text-light underline underline-offset-2 hover:text-orange transition-colors"
                                >
                                  {isExpanded ? "collapse" : "details"}
                                </button>
                                <button
                                  onClick={() => {
                                    setExpandedProductSlug(null);
                                    setProductForm(isEditing ? null : itemToForm(item, slug));
                                  }}
                                  className="text-[0.72rem] text-orange underline underline-offset-2 hover:opacity-70 transition-opacity"
                                >
                                  {isEditing ? "cancel" : "edit"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Detail expand */}
                          {isExpanded && (
                            <tr key={`${slug}-detail`} className="border-b border-[rgba(26,26,24,0.06)] bg-[rgba(26,26,24,0.015)]">
                              <td colSpan={7} className="px-5 py-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                                  {/* Left: text */}
                                  <div className="flex flex-col gap-4 text-[0.82rem]">
                                    {!!item.tagline && (
                                      <div>
                                        <p className={labelCls}>tagline</p>
                                        <p className="mt-1">{String(item.tagline)}</p>
                                      </div>
                                    )}
                                    {!!item.description && (
                                      <div>
                                        <p className={labelCls}>description</p>
                                        <p className="mt-1 leading-relaxed text-text-light">{String(item.description)}</p>
                                      </div>
                                    )}
                                    {Array.isArray(item.tags) && (item.tags as string[]).length > 0 && (
                                      <div>
                                        <p className={labelCls}>tags</p>
                                        <p className="mt-1 text-text-light">{(item.tags as string[]).join(", ")}</p>
                                      </div>
                                    )}
                                    {typeof item.details === "object" && item.details !== null && Object.keys(item.details as object).length > 0 && (
                                      <div>
                                        <p className={labelCls}>details</p>
                                        <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-[0.82rem]">
                                          {Object.entries(item.details as Record<string, string>).map(([k, v]) => (
                                            <>
                                              <dt key={`k-${k}`} className="text-text-light">{k}</dt>
                                              <dd key={`v-${k}`}>{v}</dd>
                                            </>
                                          ))}
                                        </dl>
                                      </div>
                                    )}
                                  </div>
                                  {/* Right: images + shipping */}
                                  <div className="flex flex-col gap-4 text-[0.82rem]">
                                    {images.length > 0 && (
                                      <div>
                                        <p className={labelCls}>images</p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {images.map((src) => (
                                            <a key={src} href={src} target="_blank" rel="noreferrer" className="block">
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={src} alt="" className="w-16 h-16 object-cover rounded hover:opacity-80 transition-opacity" />
                                            </a>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {!!(item.weight || item.length || item.width || item.height) && (
                                      <div>
                                        <p className={labelCls}>shipping</p>
                                        <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-text-light">
                                          {!!item.weight && <><dt>weight</dt><dd>{String(item.weight)} oz</dd></>}
                                          {!!(item.length && item.width && item.height) && (
                                            <><dt>dimensions</dt><dd>{String(item.length)}″ × {String(item.width)}″ × {String(item.height)}″</dd></>
                                          )}
                                        </dl>
                                      </div>
                                    )}
                                    <div>
                                      <p className={labelCls}>id</p>
                                      <p className="mt-1 font-mono text-[0.68rem] text-text-light break-all">{slug}</p>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Edit form expand */}
                          {isEditing && productForm && productForm.slug !== null && (
                            <tr key={`${slug}-edit`} className="border-b border-[rgba(26,26,24,0.06)] bg-[rgba(26,26,24,0.01)]">
                              <td colSpan={7} className="px-6 py-6">
                                <form onSubmit={saveProduct} className="flex flex-col gap-5 max-w-3xl">
                                  <p className="text-[0.68rem] tracking-widest uppercase text-text-light font-medium">
                                    editing — <span className="font-mono text-[#1A1A18]">{productForm.slug}</span>
                                  </p>
                                  <ProductFormBody form={productForm} setForm={setProductForm} uploadImage={uploadImage} />
                                  <div className="flex items-center gap-4">
                                    <button type="submit" disabled={productForm.saving || productForm.pendingImages.some((img) => img.uploading)} className={submitBtnCls}>
                                      {productForm.saving ? "saving…" : productForm.pendingImages.some((img) => img.uploading) ? "uploading…" : "save"}
                                    </button>
                                    <button type="button" onClick={() => setProductForm(null)} className="text-sm text-text-light underline underline-offset-2">cancel</button>
                                    {productForm.error && <p className="text-sm text-red-600">{productForm.error}</p>}
                                  </div>
                                </form>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            ) : activeTable === "orders" ? (

              /* ── Compact orders table ────────────────────────────────────── */
              <div className="rounded border border-[rgba(26,26,24,0.1)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(26,26,24,0.1)] bg-[rgba(26,26,24,0.03)]">
                      {["order", "customer", "items", "total", "status", "date"].map((h) => (
                        <th key={h} className="text-left py-3 px-3 text-[0.65rem] tracking-widest uppercase text-text-light font-medium whitespace-nowrap">{h}</th>
                      ))}
                      <th className="text-left py-3 px-3 text-[0.65rem] tracking-widest uppercase text-text-light font-medium whitespace-nowrap">actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((item) => {
                      const orderId = item.orderId as string;
                      const customer = (item.customer ?? {}) as { name?: string; email?: string; phone?: string; shipping?: Record<string, unknown> | null };
                      const orderItems = Array.isArray(item.items) ? item.items as Array<{ slug: string; name: string; price: number }> : [];
                      const shipped = !!item.shipping;
                      const isExpanded = expandedOrderId === orderId;
                      const shipToLines = customer.shipping && typeof customer.shipping === "object"
                        ? formatShipTo(customer.shipping as Record<string, unknown>)
                        : [];
                      const isShipOpen = shippingForm?.orderId === orderId;
                      const isNotesOpen = orderNotes?.orderId === orderId;
                      const firstItem = orderItems[0]?.name ?? "";
                      const moreCount = orderItems.length - 1;

                      return (
                        <>
                          <tr key={orderId} className="border-b border-[rgba(26,26,24,0.06)] hover:bg-[rgba(26,26,24,0.02)] transition-colors">
                            {/* Order ID */}
                            <td className="py-3 px-3 align-middle font-mono text-[0.68rem] text-text-light whitespace-nowrap">
                              {String(orderId).slice(0, 14)}…
                            </td>
                            {/* Customer */}
                            <td className="py-3 px-3 align-middle max-w-[160px]">
                              <div className="text-[0.85rem]">{customer.name ?? ""}</div>
                              <div className="text-[0.72rem] text-text-light">{customer.email ?? ""}</div>
                            </td>
                            {/* Items */}
                            <td className="py-3 px-3 align-middle text-[0.82rem] max-w-[180px]">
                              {firstItem}{moreCount > 0 && <span className="text-text-light"> +{moreCount}</span>}
                            </td>
                            {/* Total */}
                            <td className="py-3 px-3 align-middle text-[0.82rem] whitespace-nowrap">${String(item.total ?? "")}</td>
                            {/* Status */}
                            <td className="py-3 px-3 align-middle whitespace-nowrap">
                              <span className={`text-[0.62rem] tracking-widest uppercase font-medium ${shipped ? "text-text-light" : "text-orange"}`}>
                                {shipped ? "shipped" : "pending"}
                              </span>
                            </td>
                            {/* Date */}
                            <td className="py-3 px-3 align-middle text-[0.78rem] text-text-light whitespace-nowrap">{fmtDate(item.createdAt)}</td>
                            {/* Actions */}
                            <td className="py-3 px-3 align-middle">
                              <div className="flex flex-col gap-1.5 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setExpandedOrderId(isExpanded ? null : orderId);
                                    if (isShipOpen) setShippingForm(null);
                                    if (isNotesOpen) setOrderNotes(null);
                                  }}
                                  className="text-[0.72rem] text-text-light underline underline-offset-2 hover:text-orange transition-colors"
                                >
                                  {isExpanded ? "collapse" : "details"}
                                </button>
                                <button
                                  onClick={() => {
                                    const s = item.shipping as { carrier?: string; service?: string; trackingNumber?: string; cost?: number } | undefined;
                                    setShippingForm(isShipOpen ? null : { orderId, carrier: (s?.carrier as "ups" | "usps") ?? "ups", service: s?.service ?? "", trackingNumber: s?.trackingNumber ?? "", cost: s?.cost !== undefined ? String(s.cost) : "", loading: false, error: null });
                                    setExpandedOrderId(null);
                                  }}
                                  className="text-[0.72rem] text-orange underline underline-offset-2 hover:opacity-70 transition-opacity"
                                >
                                  {isShipOpen ? "cancel" : shipped ? "edit shipping" : "mark shipped"}
                                </button>
                                <button
                                  onClick={() => {
                                    setOrderNotes(isNotesOpen ? null : { orderId, draft: (item.notes as string | undefined) ?? "", saving: false, error: null });
                                    setExpandedOrderId(null);
                                  }}
                                  className="text-[0.72rem] text-orange underline underline-offset-2 hover:opacity-70 transition-opacity"
                                >
                                  {isNotesOpen ? "cancel" : item.notes ? "edit note" : "add note"}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Detail expand */}
                          {isExpanded && (
                            <tr key={`${orderId}-detail`} className="border-b border-[rgba(26,26,24,0.06)] bg-[rgba(26,26,24,0.015)]">
                              <td colSpan={7} className="px-5 py-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl text-[0.82rem]">
                                  {/* Left: customer + notes */}
                                  <div className="flex flex-col gap-4">
                                    <div>
                                      <p className={labelCls}>customer</p>
                                      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                                        {customer.name  && <><dt className="text-text-light">name</dt><dd>{customer.name}</dd></>}
                                        {customer.email && <><dt className="text-text-light">email</dt><dd>{customer.email}</dd></>}
                                        {customer.phone && <><dt className="text-text-light">phone</dt><dd>{customer.phone}</dd></>}
                                      </dl>
                                    </div>
                                    {shipToLines.length > 0 && (
                                      <div>
                                        <p className={labelCls}>ship to</p>
                                        <address className="mt-1 not-italic leading-relaxed text-text-light">
                                          {shipToLines.map((line, i) => <div key={i}>{line}</div>)}
                                        </address>
                                      </div>
                                    )}
                                    {!!item.notes && (
                                      <div>
                                        <p className={labelCls}>notes</p>
                                        <p className="mt-1 text-text-light">{String(item.notes)}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className={labelCls}>order id</p>
                                      <p className="mt-1 font-mono text-[0.68rem] text-text-light break-all">{orderId}</p>
                                    </div>
                                  </div>
                                  {/* Right: items + pricing + shipping */}
                                  <div className="flex flex-col gap-4">
                                    {orderItems.length > 0 && (
                                      <div>
                                        <p className={labelCls}>items</p>
                                        <div className="mt-1 flex flex-col gap-2.5">
                                          {orderItems.map((itm) => (
                                            <div key={itm.slug}>
                                              <div className="flex items-baseline gap-2">
                                                <a href={`/shop/${itm.slug}`} target="_blank" rel="noreferrer" className="text-orange underline underline-offset-2 hover:opacity-70 transition-opacity">{itm.name}</a>
                                                <span className="text-text-light">${itm.price}</span>
                                              </div>
                                              <p className="font-mono text-[0.65rem] text-text-light mt-0.5">{itm.slug}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      <p className={labelCls}>pricing</p>
                                      <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-text-light">
                                        {!!item.subtotal && <><dt>subtotal</dt><dd>${String(item.subtotal)}</dd></>}
                                        {typeof item.tax === "object" && item.tax !== null && "amount" in (item.tax as object) && (
                                          <><dt>tax</dt><dd>${String((item.tax as { amount: number }).amount)}</dd></>
                                        )}
                                        {typeof item.selectedShipping === "object" && item.selectedShipping !== null && "amount" in (item.selectedShipping as object) && (
                                          <><dt>shipping</dt><dd>${String((item.selectedShipping as { amount: number }).amount)}</dd></>
                                        )}
                                        {!!item.total && <><dt className="font-medium text-[#1A1A18]">total</dt><dd className="font-medium text-[#1A1A18]">${String(item.total)}</dd></>}
                                      </dl>
                                    </div>
                                    {shipped && typeof item.shipping === "object" && item.shipping !== null && (
                                      <div>
                                        <p className={labelCls}>shipment</p>
                                        <dl className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1 text-text-light">
                                          {!!(item.shipping as Record<string, unknown>).carrier && (
                                            <><dt>carrier</dt><dd>{String((item.shipping as Record<string, unknown>).carrier)} {String((item.shipping as Record<string, unknown>).service ?? "")}</dd></>
                                          )}
                                          {!!(item.shipping as Record<string, unknown>).trackingNumber && (
                                            <><dt>tracking</dt><dd>
                                              {(item.shipping as Record<string, unknown>).trackingUrl
                                                ? <a href={String((item.shipping as Record<string, unknown>).trackingUrl)} target="_blank" rel="noreferrer" className="text-orange underline underline-offset-2 hover:opacity-70">{String((item.shipping as Record<string, unknown>).trackingNumber)}</a>
                                                : String((item.shipping as Record<string, unknown>).trackingNumber)}
                                            </dd></>
                                          )}
                                          {!!(item.shipping as Record<string, unknown>).shippedAt && (
                                            <><dt>shipped</dt><dd>{fmtDate((item.shipping as Record<string, unknown>).shippedAt)}</dd></>
                                          )}
                                        </dl>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Shipping form expand */}
                          {isShipOpen && shippingForm && (
                            <tr key={`${orderId}-ship`} className="border-b border-[rgba(26,26,24,0.06)] bg-[rgba(26,26,24,0.01)]">
                              <td colSpan={7} className="px-6 py-4">
                                <form onSubmit={submitShipping} className="flex flex-wrap items-end gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className={labelCls}>carrier</label>
                                    <select value={shippingForm.carrier} onChange={(e) => setShippingForm((f) => f && { ...f, carrier: e.target.value as "ups" | "usps" })} className={inputCls}>
                                      <option value="ups">UPS</option>
                                      <option value="usps">USPS</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className={labelCls}>service</label>
                                    <input type="text" value={shippingForm.service} onChange={(e) => setShippingForm((f) => f && { ...f, service: e.target.value })} required placeholder="UPS Ground" className={`${inputCls} w-40`} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className={labelCls}>tracking number</label>
                                    <input type="text" value={shippingForm.trackingNumber} onChange={(e) => setShippingForm((f) => f && { ...f, trackingNumber: e.target.value })} required placeholder="1Z999AA10123456784" className={`${inputCls} w-56`} />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className={labelCls}>label cost ($)</label>
                                    <input type="number" step="0.01" min="0" value={shippingForm.cost} onChange={(e) => setShippingForm((f) => f && { ...f, cost: e.target.value })} required placeholder="8.75" className={`${inputCls} w-28`} />
                                  </div>
                                  <button type="submit" disabled={shippingForm.loading} className={submitBtnCls}>{shippingForm.loading ? "saving..." : "save"}</button>
                                  {shippingForm.error && <p className="text-sm text-red-600">{shippingForm.error}</p>}
                                </form>
                              </td>
                            </tr>
                          )}

                          {/* Notes form expand */}
                          {isNotesOpen && orderNotes && (
                            <tr key={`${orderId}-notes`} className="border-b border-[rgba(26,26,24,0.06)] bg-[rgba(26,26,24,0.01)]">
                              <td colSpan={7} className="px-6 py-4">
                                <form onSubmit={saveOrderNotes} className="flex flex-col gap-3 max-w-lg">
                                  <label className={labelCls}>internal note — not visible to customers</label>
                                  <textarea value={orderNotes.draft} onChange={(e) => setOrderNotes((n) => n && { ...n, draft: e.target.value })} rows={3} placeholder="e.g. customer requested gift wrap, refund issued…" className="font-mono text-[0.78rem] py-3 px-4 border border-[rgba(26,26,24,0.15)] rounded bg-cream outline-none focus:border-orange transition-colors resize-y leading-relaxed" />
                                  <div className="flex items-center gap-4">
                                    <button type="submit" disabled={orderNotes.saving} className={submitBtnCls}>{orderNotes.saving ? "saving…" : "save note"}</button>
                                    <button type="button" onClick={() => setOrderNotes(null)} className="text-sm text-text-light underline underline-offset-2 hover:text-[#1A1A18] transition-colors">cancel</button>
                                    {orderNotes.error && <p className="text-sm text-red-600">{orderNotes.error}</p>}
                                  </div>
                                </form>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            ) : (

              /* ── Generic table (checkouts / inquiries / subscriptions) ───── */
              <div className="overflow-x-auto rounded border border-[rgba(26,26,24,0.1)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(26,26,24,0.1)] bg-[rgba(26,26,24,0.03)]">
                      {columns.map((col) => (
                        <th key={col} className="text-left py-3 px-4 text-[0.68rem] tracking-widest uppercase text-text-light font-medium whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayItems.map((item, i) => (
                      <tr key={i} className="border-b border-[rgba(26,26,24,0.06)] hover:bg-[rgba(26,26,24,0.02)] transition-colors">
                        {columns.map((col) => (
                          <td key={col} className="py-3 px-4 text-[0.82rem] max-w-[320px] whitespace-normal break-words font-mono align-top">
                            {renderCell(item[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.lastKey && (
              <button
                onClick={() => fetchTable(activeTable, data.lastKey, productFilter.status)}
                disabled={loading}
                className="mt-6 py-2.5 px-6 border border-[rgba(26,26,24,0.15)] rounded text-sm lowercase font-medium transition-all hover:border-orange hover:text-orange disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "loading..." : "load more"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "login";
    return sessionStorage.getItem("admin_id_token") ? "authenticated" : "login";
  });

  // Hold the CognitoUser across the new-password challenge
  const [pendingUser, setPendingUser] = useState<CognitoUser | null>(null);

  function handleLoginSuccess() {
    setView("authenticated");
  }

  function handleNewPasswordRequired(user: CognitoUser) {
    setPendingUser(user);
    setView("new-password");
  }

  function handleSignOut() {
    clearSession();
    setView("login");
  }

  if (view === "login") {
    return (
      <LoginForm
        onSuccess={handleLoginSuccess}
        onNewPasswordRequired={handleNewPasswordRequired}
      />
    );
  }

  if (view === "new-password" && pendingUser) {
    return (
      <NewPasswordForm
        user={pendingUser}
        onSuccess={handleLoginSuccess}
      />
    );
  }

  return <DataView onSignOut={handleSignOut} />;
}
