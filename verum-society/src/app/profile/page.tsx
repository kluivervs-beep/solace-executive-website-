"use client";
import { useRouter } from "next/navigation";
import { useMe } from "@/components/Shell";
import { signOut } from "@/lib/api";

export default function Profile() {
  const { me, refresh } = useMe();
  const router = useRouter();
  const q = me.questionnaire;
  return (
    <div className="fade" style={{ maxWidth: 620 }}>
      <p className="eyebrow">{me.role === "admin" ? "Beheerder" : "Lid"} van Verum Society</p>
      <h2 style={{ margin: "8px 0 4px" }}>{me.full_name}</h2>
      <p className="muted">{me.email}</p>
      <hr className="rule" />
      {q ? (
        <dl className="qa card gilded">
          <dt>Wat ik breng</dt><dd>{q.brings}</dd>
          <dt>Expertise</dt><dd>{q.expertise || "-"}</dd>
          <dt>Interesses</dt><dd>{q.interests.join(" · ") || "-"}</dd>
          <dt>Dieet</dt><dd>{q.dietary || "-"}</dd>
          {q.instagram && (<><dt>Instagram</dt><dd>{q.instagram}</dd></>)}
        </dl>
      ) : <p className="muted">Geen vragenlijst ingevuld.</p>}
      <div style={{ marginTop: 28 }}>
        <button className="btn" onClick={async () => { await signOut(); await refresh(); router.replace("/login"); }}>Uitloggen</button>
      </div>
    </div>
  );
}
