"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { compressFile, getLocation, LocationError, type GeoFix } from "@/lib/image";
import { MAX_COMPANY, MAX_FILE_BYTES, MAX_MEMBERS, MAX_MEMBER_NAME, MAX_PHOTOS, MAX_PURPOSE } from "@/lib/limits";
import { CameraCapture, type CameraPhoto } from "./CameraCapture";
import { PhotoCard, type DraftPhoto } from "./PhotoCard";

type Errors = Partial<Record<"companyName" | "accompanyingMembers" | "photos" | "purpose" | "form", string>>;

type Status = { kind: "idle" } | { kind: "submitting"; label: string } | { kind: "done" } | { kind: "signedOut" };

let keySeq = 0;
const newKey = () => `p${++keySeq}`;

export function ReportForm() {
  const [companyName, setCompanyName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [memberDraft, setMemberDraft] = useState("");
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [purpose, setPurpose] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [camera, setCamera] = useState<{ open: boolean; file?: File }>({ open: false });
  const [processing, setProcessing] = useState(0);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);

  // Free preview object URLs when leaving the page.
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const slotsLeft = MAX_PHOTOS - photos.length - processing;
  const busy = status.kind === "submitting";

  // ---------- Members ----------
  function addMember() {
    const name = memberDraft.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (name.length > MAX_MEMBER_NAME) return setErrors((e) => ({ ...e, accompanyingMembers: "That name is too long." }));
    if (members.length >= MAX_MEMBERS) return setErrors((e) => ({ ...e, accompanyingMembers: `Up to ${MAX_MEMBERS} members.` }));
    if (!members.some((m) => m.toLowerCase() === name.toLowerCase())) setMembers((m) => [...m, name]);
    setMemberDraft("");
    setErrors((e) => ({ ...e, accompanyingMembers: undefined }));
  }

  // ---------- Photos ----------
  function addPhoto(p: Omit<DraftPhoto, "key" | "previewUrl">) {
    setPhotos((list) => [...list, { ...p, key: newKey(), previewUrl: URL.createObjectURL(p.blob) }]);
    setErrors((e) => ({ ...e, photos: undefined }));
  }

  function openCamera() {
    setPhotoNotice(null);
    if (slotsLeft <= 0) return setPhotoNotice(`You can add up to ${MAX_PHOTOS} photos.`);
    if (!companyName.trim()) {
      setErrors((e) => ({ ...e, companyName: "Enter the company name first. It is stamped on camera photos." }));
      document.getElementById("companyName")?.focus();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      // No in-app camera: hand off to the phone's camera app (still geo-stamped).
      fallbackInputRef.current?.click();
      return;
    }
    setCamera({ open: true });
  }

  function onFallbackCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return setPhotoNotice("That photo is larger than 10 MB.");
    setCamera({ open: true, file });
  }

  const onCameraCapture = useCallback((shot: CameraPhoto) => {
    setCamera({ open: false });
    setPhotos((list) => [
      ...list,
      {
        key: newKey(),
        blob: shot.blob,
        previewUrl: URL.createObjectURL(shot.blob),
        source: "camera",
        capturedAt: shot.capturedAt,
        fix: shot.fix,
      },
    ]);
    setErrors((e) => ({ ...e, photos: undefined }));
  }, []);

  const closeCamera = useCallback(() => setCamera({ open: false }), []);

  async function onUploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const problems: string[] = [];
    const accepted = files.filter((f) => {
      if (!f.type.startsWith("image/")) return problems.push(`${f.name} is not an image.`), false;
      if (f.size > MAX_FILE_BYTES) return problems.push(`${f.name} is larger than 10 MB.`), false;
      return true;
    });
    const room = Math.max(0, slotsLeft);
    if (accepted.length > room) problems.push(`Only ${MAX_PHOTOS} photos are allowed per report; ${accepted.length - room} skipped.`);
    const batch = accepted.slice(0, room);

    setProcessing((n) => n + batch.length);
    const now = new Date();
    for (const file of batch) {
      try {
        const blob = await compressFile(file);
        addPhoto({ blob, source: "upload", capturedAt: now, fix: null });
      } catch (err) {
        problems.push(`${file.name}: ${err instanceof Error ? err.message : "could not be read."}`);
      } finally {
        setProcessing((n) => n - 1);
      }
    }
    setPhotoNotice(problems.length ? problems.join(" ") : null);
  }

  function removePhoto(key: string) {
    setPhotos((list) => {
      const target = list.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return list.filter((p) => p.key !== key);
    });
  }

  function updatePhoto(key: string, patch: Partial<DraftPhoto>) {
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  async function locateUpload(key: string): Promise<string | null> {
    try {
      const fix: GeoFix = await getLocation(30_000);
      updatePhoto(key, { fix });
      return null;
    } catch (err) {
      return err instanceof LocationError ? err.message : "Could not get your location.";
    }
  }

  // ---------- Submit ----------
  function validate(pendingMembers: string[]): Errors {
    const next: Errors = {};
    if (!companyName.trim()) next.companyName = "Company name is required.";
    if (photos.length === 0) next.photos = "Add at least one photo.";
    else if (photos.some((p) => p.source === "upload" && (Number.isNaN(p.capturedAt.getTime()) || p.capturedAt.getTime() > Date.now() + 60_000)))
      next.photos = "Set a valid date and time (not in the future) for each uploaded photo.";
    if (!purpose.trim()) next.purpose = "Purpose of visit is required.";
    if (pendingMembers.length > MAX_MEMBERS) next.accompanyingMembers = `Up to ${MAX_MEMBERS} members.`;
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || processing > 0) return;

    // A typed-but-not-added member name still counts.
    const pending = memberDraft.trim().replace(/\s+/g, " ");
    const allMembers = pending && !members.some((m) => m.toLowerCase() === pending.toLowerCase()) ? [...members, pending] : members;

    const found = validate(allMembers);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (["companyName", "accompanyingMembers", "photos", "purpose"] as const).find((k) => found[k]);
      document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (allMembers !== members) {
      setMembers(allMembers);
      setMemberDraft("");
    }

    try {
      // Upload one at a time; already-uploaded photos are skipped on a retry.
      const uploaded: DraftPhoto[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        setStatus({ kind: "submitting", label: `Uploading photo ${i + 1} of ${photos.length}…` });
        if (p.blobUrl) {
          uploaded.push(p);
          continue;
        }
        const body = new FormData();
        body.append("file", p.blob, "photo.jpg");
        const res = await fetch("/api/photos", { method: "POST", body });
        if (res.status === 401) return setStatus({ kind: "signedOut" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || `Photo ${i + 1} failed to upload.`);
        updatePhoto(p.key, { blobUrl: data.url });
        uploaded.push({ ...p, blobUrl: data.url });
      }

      setStatus({ kind: "submitting", label: "Saving report…" });
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          accompanyingMembers: allMembers,
          purpose: purpose.trim(),
          photos: uploaded.map((p) => ({
            blobUrl: p.blobUrl,
            source: p.source,
            capturedAt: p.capturedAt.toISOString(),
            latitude: p.fix?.latitude ?? null,
            longitude: p.fix?.longitude ?? null,
            accuracyM: p.fix?.accuracy ?? null,
          })),
        }),
      });
      if (res.status === 401) return setStatus({ kind: "signedOut" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ ...(data.errors ?? {}), form: data.error || "Could not save the report. Please try again." });
        setStatus({ kind: "idle" });
        return;
      }
      setStatus({ kind: "done" });
      window.scrollTo({ top: 0 });
    } catch (err) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      setErrors({ form: offline ? "You appear to be offline. Your entries are kept; tap Submit again when connected." : err instanceof Error ? err.message : "Something went wrong." });
      setStatus({ kind: "idle" });
    }
  }

  function reset() {
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setCompanyName("");
    setMembers([]);
    setMemberDraft("");
    setPhotos([]);
    setPurpose("");
    setErrors({});
    setPhotoNotice(null);
    setStatus({ kind: "idle" });
  }

  // ---------- Render ----------
  if (status.kind === "done") {
    return (
      <div className="card flex flex-col items-center px-6 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold">Report submitted</h1>
        <p className="mt-1 text-muted">Your visit to {companyName.trim()} has been recorded.</p>
        <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
          <button type="button" onClick={reset} className="btn btn-primary">
            Report another visit
          </button>
          <Link href="/visits" className="btn btn-ghost">
            View my visits
          </Link>
        </div>
      </div>
    );
  }

  if (status.kind === "signedOut") {
    return (
      <div className="card p-6 text-center" role="alert">
        <h1 className="text-xl font-bold">Session expired</h1>
        <p className="mt-1 text-muted">Please sign in again. This report was not saved.</p>
        <a href="/login" className="btn btn-primary mt-5">
          Sign in
        </a>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <p className="section-label">Industry Visit</p>
          <h1 className="mt-0.5 text-2xl font-bold">Report a visit</h1>
        </div>

        {/* Company */}
        <section id="field-companyName" className="card p-4">
          <label htmlFor="companyName" className="section-label">
            Company Name <span className="text-danger">*</span>
          </label>
          <input
            id="companyName"
            className="field mt-2"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={MAX_COMPANY}
            autoComplete="organization"
            enterKeyHint="next"
            placeholder="e.g. Tata Motors, Pimpri"
            aria-invalid={errors.companyName ? true : undefined}
            aria-describedby={errors.companyName ? "companyName-error" : undefined}
          />
          {errors.companyName && (
            <p id="companyName-error" className="error-text">
              {errors.companyName}
            </p>
          )}
        </section>

        {/* Members */}
        <section id="field-accompanyingMembers" className="card p-4">
          <label htmlFor="memberDraft" className="section-label">
            Accompanying Members <span className="font-medium normal-case tracking-normal text-muted">(optional)</span>
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="memberDraft"
              className="field"
              value={memberDraft}
              onChange={(e) => setMemberDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMember();
                }
              }}
              maxLength={MAX_MEMBER_NAME}
              enterKeyHint="done"
              autoComplete="off"
              placeholder="Type a name"
              aria-invalid={errors.accompanyingMembers ? true : undefined}
            />
            <button type="button" onClick={addMember} className="btn btn-secondary shrink-0">
              Add
            </button>
          </div>
          {members.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <li key={m} className="chip">
                  {m}
                  <button
                    type="button"
                    onClick={() => setMembers((list) => list.filter((x) => x !== m))}
                    aria-label={`Remove ${m}`}
                    className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-teal/20"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {errors.accompanyingMembers && <p className="error-text">{errors.accompanyingMembers}</p>}
        </section>

        {/* Photos */}
        <section id="field-photos" className="card p-4">
          <div className="flex items-baseline justify-between">
            <span className="section-label">
              Photos <span className="text-danger">*</span>
            </span>
            <span className="text-xs text-muted">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={openCamera} disabled={busy || slotsLeft <= 0} className="btn btn-primary !py-3">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7h-3l-2-3H9L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              Take Photo
            </button>
            <label className={`btn btn-secondary !py-3 ${busy || slotsLeft <= 0 ? "pointer-events-none opacity-60" : ""}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
              </svg>
              Upload Photo
              <input type="file" accept="image/*" multiple className="sr-only" onChange={onUploadFiles} disabled={busy || slotsLeft <= 0} />
            </label>
          </div>
          <input ref={fallbackInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFallbackCapture} />
          <p className="mt-2 text-xs text-muted">Camera photos are stamped with date, time and location. Uploads need a date and time.</p>

          {photoNotice && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              {photoNotice}
            </p>
          )}
          {errors.photos && <p className="error-text">{errors.photos}</p>}

          {(photos.length > 0 || processing > 0) && (
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {photos.map((p) => (
                <PhotoCard
                  key={p.key}
                  photo={p}
                  disabled={busy}
                  onRemove={() => removePhoto(p.key)}
                  onTimeChange={(value) => updatePhoto(p.key, { capturedAt: value ? new Date(value) : new Date(NaN) })}
                  onLocate={() => locateUpload(p.key)}
                  onClearLocation={() => updatePhoto(p.key, { fix: null })}
                />
              ))}
              {Array.from({ length: processing }, (_, i) => (
                <li key={`proc-${i}`} className="flex h-24 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
                  Preparing photo…
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Purpose */}
        <section id="field-purpose" className="card p-4">
          <div className="flex items-baseline justify-between">
            <label htmlFor="purpose" className="section-label">
              Purpose of Visit <span className="text-danger">*</span>
            </label>
            <span className={`text-xs ${purpose.length > MAX_PURPOSE * 0.9 ? "text-danger" : "text-muted"}`} aria-live="polite">
              {purpose.length}/{MAX_PURPOSE}
            </span>
          </div>
          <textarea
            id="purpose"
            className="field mt-2 min-h-32 resize-y"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            maxLength={MAX_PURPOSE}
            placeholder="Why did you visit? e.g. internship tie-up, plant tour for final-year students, guest lecture discussion"
            aria-invalid={errors.purpose ? true : undefined}
            aria-describedby={errors.purpose ? "purpose-error" : undefined}
          />
          {errors.purpose && (
            <p id="purpose-error" className="error-text">
              {errors.purpose}
            </p>
          )}
        </section>

        {errors.form && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger" role="alert">
            {errors.form}
          </p>
        )}

        <button type="submit" disabled={busy || processing > 0} className="btn btn-primary w-full !py-3.5 text-base">
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {status.label}
            </>
          ) : (
            "Submit Report"
          )}
        </button>
      </form>

      {camera.open && <CameraCapture companyName={companyName} initialFile={camera.file} onCapture={onCameraCapture} onClose={closeCamera} />}
    </>
  );
}

