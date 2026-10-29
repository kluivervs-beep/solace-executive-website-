"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMe } from "@/components/Shell";
import { listMessages, sendMessage, subscribeMessages } from "@/lib/api";
import { ROOMS, type Message } from "@/lib/types";

export default function Chat() {
  const { me } = useMe();
  const [room, setRoom] = useState<string>(ROOMS[0].id);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const log = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => setMsgs(await listMessages(room)), [room]);
  useEffect(() => {
    load();
    return subscribeMessages(room, load);
  }, [room, load]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    await sendMessage(room, me, body);
    load();
  };
  const cur = ROOMS.find((r) => r.id === room)!;

  return (
    <div className="fade">
      <p className="eyebrow">Alleen voor leden</p>
      <h2 style={{ margin: "8px 0 24px" }}>Chat</h2>
      <div className="chat">
        <div className="rooms">
          {ROOMS.map((r) => (
            <button key={r.id} className={`room ${r.id === room ? "on" : ""}`} onClick={() => setRoom(r.id)}>
              <b>{r.name}</b><small>{r.blurb}</small>
            </button>
          ))}
        </div>
        <div className="pane">
          <div className="log" ref={log}>
            {msgs.length === 0 && <p className="muted" style={{ margin: "auto" }}>Stil in {cur.name}. Begin het gesprek.</p>}
            {msgs.map((m) => (
              <div key={m.id} className={`msg ${m.user_id === me.id ? "me" : ""}`}>
                <div className="who">{m.user_id === me.id ? "Jij" : m.author_name}<span>{new Date(m.created_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</span></div>
                <p>{m.body}</p>
              </div>
            ))}
          </div>
          <form className="composer" onSubmit={send}>
            <input type="text" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder={`Bericht in ${cur.name}…`} />
            <button className="btn solid">Stuur</button>
          </form>
        </div>
      </div>
    </div>
  );
}
