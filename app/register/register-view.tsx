// Copyright 2025-2026 Alexander J. Sánchez T.
// SPDX-License-Identifier: FSL-1.1-ALv2

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard, AuthPage, ErrorNote, Field, inputClass, SubmitButton } from "@/components/auth-shell";
import { useLang } from "@/components/language";
import { countryOptions, registerAccount, rememberPendingEmail, type AccountProfile } from "@/lib/onboarding";
import { IdentityError } from "@/lib/session";

const EMPTY: AccountProfile = {
  kind: "company",
  legal_name: "",
  registration_number: "",
  tax_id: "",
  country: "",
  region: "",
  city: "",
  address_line: "",
  postal_code: "",
  website: "",
  phone: "",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-0 p-0">
      <legend className="mb-1 text-[11px] font-semibold tracking-widest text-ink-faint uppercase">{title}</legend>
      {children}
    </fieldset>
  );
}

function RegisterForm() {
  const router = useRouter();
  const { t, lang } = useLang();
  const c = t.register;
  const [p, setP] = useState<AccountProfile>(EMPTY);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countries = useMemo(() => countryOptions(lang), [lang]);

  const set = (key: keyof AccountProfile) => (e: { target: { value: string } }) =>
    setP((prev) => ({ ...prev, [key]: e.target.value }));
  const mismatch = confirm !== "" && password !== confirm;
  const incomplete =
    !email.trim() || !password || !confirm || !p.legal_name.trim() || !p.tax_id.trim() || !p.country ||
    !p.region.trim() || !p.city.trim() || !p.address_line.trim() || !p.postal_code.trim() || !p.phone.trim();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || incomplete || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await registerAccount({
        email: email.trim(),
        password,
        profile: { ...p, registration_number: p.kind === "company" ? p.registration_number : "" },
      });
      rememberPendingEmail(email.trim());
      router.push("/register/verify");
    } catch (err) {
      if (err instanceof IdentityError && err.status === 409) setError(c.errEmailTaken);
      else if (err instanceof IdentityError && (err.status === 404 || err.status === 405)) setError(c.errDisabled);
      else if (err instanceof IdentityError && err.status === 400) setError(err.message); // names the field
      else if (err instanceof Error && err.message === "network") setError(c.errNetwork);
      else setError(c.errGeneric);
      setBusy(false);
    }
  }

  return (
    <AuthCard title={c.title}>
      <p className="mb-5 text-xs text-ink-muted">{c.intro}</p>
      <form onSubmit={onSubmit} className="space-y-6">
        <Section title={c.sectionData}>
          <div role="radiogroup" aria-label={c.kindLabel} className="grid grid-cols-2 gap-2">
            {(["company", "person"] as const).map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-center justify-center rounded-(--radius-control) border px-3 py-2.5 text-sm transition-colors ${
                  p.kind === k
                    ? "border-accent/60 bg-accent-soft font-medium text-accent"
                    : "border-edge-strong text-ink-muted hover:text-ink"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={p.kind === k}
                  onChange={() => setP((prev) => ({ ...prev, kind: k }))}
                  className="sr-only"
                />
                {k === "company" ? c.kindCompany : c.kindPerson}
              </label>
            ))}
          </div>
          <Field label={p.kind === "company" ? c.legalNameCompany : c.legalNamePerson}>
            <input type="text" required maxLength={255} value={p.legal_name} onChange={set("legal_name")} className={inputClass} autoComplete="organization" />
          </Field>
          {p.kind === "company" && (
            <Field label={c.registrationNumber}>
              <input type="text" maxLength={64} value={p.registration_number} onChange={set("registration_number")} className={inputClass} />
            </Field>
          )}
          <Field label={c.taxId}>
            <input type="text" required maxLength={64} value={p.tax_id} onChange={set("tax_id")} className={inputClass} />
          </Field>
          <Field label={c.website}>
            <input type="url" maxLength={255} value={p.website} onChange={set("website")} placeholder="https://" className={inputClass} autoComplete="url" />
          </Field>
        </Section>

        <Section title={c.sectionAddress}>
          <Field label={c.country}>
            <select required value={p.country} onChange={set("country")} className={`${inputClass} bg-surface-raised`} autoComplete="country">
              <option value="">{c.countryPlaceholder}</option>
              {countries.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={c.region}>
              <input type="text" required maxLength={100} value={p.region} onChange={set("region")} className={inputClass} autoComplete="address-level1" />
            </Field>
            <Field label={c.city}>
              <input type="text" required maxLength={100} value={p.city} onChange={set("city")} className={inputClass} autoComplete="address-level2" />
            </Field>
          </div>
          <Field label={c.address}>
            <input type="text" required maxLength={255} value={p.address_line} onChange={set("address_line")} className={inputClass} autoComplete="street-address" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={c.postalCode}>
              <input type="text" required maxLength={20} value={p.postal_code} onChange={set("postal_code")} className={inputClass} autoComplete="postal-code" />
            </Field>
            <Field label={c.phone} hint={c.phoneHint}>
              <input type="tel" required maxLength={32} value={p.phone} onChange={set("phone")} placeholder="+" className={inputClass} autoComplete="tel" />
            </Field>
          </div>
        </Section>

        <Section title={c.sectionAccess}>
          <Field label={c.emailLabel} hint={c.emailHint}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} autoComplete="username" />
          </Field>
          <Field label={c.passwordLabel} hint={c.passwordHint}>
            <input type="password" required minLength={12} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} autoComplete="new-password" />
          </Field>
          <Field label={c.confirmLabel}>
            <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} autoComplete="new-password" />
          </Field>
          {mismatch && <ErrorNote>{c.mismatch}</ErrorNote>}
        </Section>

        {error && <ErrorNote>{error}</ErrorNote>}
        <SubmitButton busy={busy} disabled={incomplete || mismatch} label={c.submit} busyLabel={c.busy} />
      </form>
      <p className="mt-4 text-center text-[11px] text-ink-faint">
        {c.haveAccountPre}
        <Link href="/login" className="text-accent hover:underline">
          {c.haveAccountLink}
        </Link>
        .
      </p>
    </AuthCard>
  );
}

export function RegisterView() {
  return (
    <AuthPage wide>
      <RegisterForm />
    </AuthPage>
  );
}
