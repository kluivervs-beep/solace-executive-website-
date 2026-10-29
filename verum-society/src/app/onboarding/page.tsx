"use client";
import { useState } from "react";
import { Mark } from "@/components/Logo";
import { useMe } from "@/components/Shell";
import { saveQuestionnaire } from "@/lib/api";
import { INTEREST_OPTIONS, type Questionnaire } from "@/lib/types";

export default function Onboarding() {
  const { me, refresh } = useMe();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState<Questionnaire>({ brings: "", interests: [], expertise: "", why: "", dietary: "", instagram: "" });
  const set = <K extends keyof Questionnaire>(k: K, v: Questionnaire[K]) => setQ((p) => ({ ...p, [k]: v }));
  const toggle = (i: string) => set("interests", q.interests.includes(i) ? q.interests.filter((x) => x !== i) : [...q.interests, i]);

  const steps = [
    {
      title: "Wat breng jij naar Verum?",
      ok: q.brings.trim().length > 3,
      body: (
        <>
          <p className="muted" style={{ marginBottom: 24 }}>Verum is wat leden er samen van maken. Vertel ons wat jij toevoegt aan de tafel.</p>
          <div className="field">
            <label>Jouw bijdrage</label>
            <textarea value={q.brings} onChange={(e) => set("brings", e.target.value)} placeholder="Bijvoorbeeld: ik kook, ik ken de beste tafels in de stad, ik draai muziek, ik breng mensen bij elkaar…" />
          </div>
          <div className="field">
            <label>Jouw vak of expertise</label>
            <input type="text" value={q.expertise} onChange={(e) => set("expertise", e.target.value)} placeholder="Wat doe je, en waar ben je goed in?" />
          </div>
        </>
      ),
    },
    {
      title: "Waar word je blij van?",
      ok: q.interests.length > 0,
      body: (
        <>
          <p className="muted" style={{ marginBottom: 24 }}>Kies wat bij je past. Zo plannen we avonden waar je graag bij bent.</p>
          <div className="chips">
            {INTEREST_OPTIONS.map((i) => <button type="button" key={i} className={`chip ${q.interests.includes(i) ? "on" : ""}`} onClick={() => toggle(i)}>{i}</button>)}
          </div>
          <div className="field" style={{ marginTop: 28 }}>
            <label>Dieetwensen of allergieën</label>
            <input type="text" value={q.dietary} onChange={(e) => set("dietary", e.target.value)} placeholder="Geen, vegetarisch, notenallergie…" />
          </div>
        </>
      ),
    },
    {
      title: "Waarom Verum?",
      ok: q.why.trim().length > 3,
      body: (
        <>
          <div className="field">
            <label>Waarom wil je lid worden?</label>
            <textarea value={q.why} onChange={(e) => set("why", e.target.value)} placeholder="Wat zoek je in een besloten club?" />
          </div>
          <div className="field">
            <label>Instagram (optioneel)</label>
            <input type="text" value={q.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@jouwnaam" />
          </div>
        </>
      ),
    },
  ];
  const s = steps[step];

  const finish = async () => {
    setBusy(true);
    await saveQuestionnaire(q);
    await refresh();
  };

  return (
    <div className="center">
      <div className="auth fade" style={{ width: "min(560px,100%)" }}>
        <div className="mono" style={{ marginBottom: 22 }}><Mark size={48} /></div>
        <div className="steps">{steps.map((_, i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>
        <p className="eyebrow">Welkom, {me.full_name.split(" ")[0]} · Stap {step + 1} van {steps.length}</p>
        <h1 className="gold-text" style={{ fontSize: "2.2rem", margin: "10px 0 20px" }}>{s.title}</h1>
        <div style={{ textAlign: "left" }}>{s.body}</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 12 }}>
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Terug</button>}
          {step < steps.length - 1
            ? <button className="btn solid" disabled={!s.ok} onClick={() => setStep(step + 1)}>Verder</button>
            : <button className="btn solid" disabled={!s.ok || busy} onClick={finish}>Aanvraag versturen</button>}
        </div>
      </div>
    </div>
  );
}
