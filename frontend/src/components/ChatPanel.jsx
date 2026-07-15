import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/useAuth';
import OpsIcon from './OpsIcon';
import { API_URL as API } from '../config';

function otherParticipant(session, userId) {
  return session.adminId === userId ? session.pilot : session.admin;
}

function ChatPanel() {
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const selectedSessionRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [connection, setConnection] = useState('Connecting…');
  const [notice, setNotice] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${API}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'Chat request failed');
    return data;
  }, [token]);

  const loadSessions = useCallback(async () => {
    try { const data = await request('/api/chat/sessions'); setSessions(data.sessions || []); }
    catch (error) { setNotice({ kind: 'error', message: error.message }); }
  }, [request]);

  const loadParticipants = useCallback(async () => {
    try { const data = await request('/api/chat/participants'); setParticipants(data.participants || []); }
    catch (error) { setNotice({ kind: 'error', message: error.message }); }
  }, [request]);

  const updateReadState = useCallback((payload) => {
    if (payload.sessionId !== selectedSessionRef.current) return;
    const readIds = new Set(payload.messageIds || []);
    setMessages((current) => current.map((message) => readIds.has(message.id) ? { ...message, readAt: payload.readAt } : message));
  }, []);

  const updateClosedState = useCallback((payload) => {
    setSessions((current) => current.map((session) => session.id === payload.sessionId ? { ...session, status: 'CLOSED', closedAt: payload.closedAt } : session));
    if (payload.sessionId === selectedSessionRef.current) setSelectedSession((current) => current ? { ...current, status: 'CLOSED', closedAt: payload.closedAt } : current);
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    const socket = io(API, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnection('Live');
      if (selectedSessionRef.current) socket.emit('chat:join', { sessionId: selectedSessionRef.current });
    });
    socket.on('connect_error', (error) => setConnection(error.message || 'Connection failed'));
    socket.on('disconnect', () => setConnection('Reconnecting…'));
    socket.on('chat:message', (message) => {
      if (message.sessionId === selectedSessionRef.current) setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      void loadSessions();
    });
    socket.on('chat:read', updateReadState);
    socket.on('chat:closed', (payload) => {
      updateClosedState(payload);
      setNotice({ kind: 'success', message: 'This chat was closed by an administrator.' });
    });
    return () => socket.disconnect();
  }, [loadSessions, token, updateClosedState, updateReadState]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadSessions(); void loadParticipants(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadParticipants, loadSessions]);

  const socketRequest = useCallback((event, payload) => new Promise((resolve, reject) => {
    const socket = socketRef.current;
    if (!socket?.connected) { reject(new Error('Live chat is reconnecting. Please wait a moment and try again.')); return; }
    socket.emit(event, payload, (result) => result?.success ? resolve(result) : reject(new Error(result?.error || 'Chat request failed')));
  }), []);

  const markRead = useCallback(async (sessionId) => {
    try { updateReadState(await socketRequest('chat:read', { sessionId })); }
    catch (error) {
      try {
        const result = await request(`/api/chat/sessions/${sessionId}/read`, { method: 'POST' });
        updateReadState({ sessionId, ...result });
      } catch (fallbackError) { setNotice({ kind: 'error', message: fallbackError.message || error.message }); }
    }
  }, [request, socketRequest, updateReadState]);

  const selectSession = useCallback(async (session) => {
    try {
      const data = await request(`/api/chat/sessions/${session.id}/messages`);
      selectedSessionRef.current = session.id;
      setSelectedSession(data.session);
      setMessages(data.messages || []);
      if (socketRef.current?.connected) await socketRequest('chat:join', { sessionId: session.id });
      await markRead(session.id);
    } catch (error) { setNotice({ kind: 'error', message: error.message }); }
  }, [markRead, request, socketRequest]);

  const createSession = async (event) => {
    event.preventDefault();
    if (!participantId) return;
    try {
      const data = await request('/api/chat/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantId }) });
      await loadSessions();
      await selectSession(data.session);
      setParticipantId('');
      setNotice({ kind: 'success', message: data.created ? 'New chat opened.' : 'Opened the existing chat.' });
    } catch (error) { setNotice({ kind: 'error', message: error.message }); }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!selectedSession || !draft.trim()) return;
    try { await socketRequest('chat:send', { sessionId: selectedSession.id, content: draft }); setDraft(''); }
    catch (error) { setNotice({ kind: 'error', message: error.message }); }
  };

  const closeSelectedSession = async () => {
    if (!selectedSession || !window.confirm('Close this chat for both participants?')) return;
    try {
      let result;
      try { result = await socketRequest('chat:close', { sessionId: selectedSession.id }); }
      catch (socketError) {
        result = await request(`/api/chat/sessions/${selectedSession.id}/close`, { method: 'POST' });
        if (!result) throw socketError;
      }
      updateClosedState(result);
      setNotice({ kind: 'success', message: 'Chat closed for both participants.' });
    } catch (error) { setNotice({ kind: 'error', message: error.message }); }
  };

  return (
    <section className="panel panel--raised chat-panel">
      <div className="panel-header">
        <div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="chat" /></span><h2>Admin–Pilot support chat</h2></div><p>Unread chats stay open. Fully read inactive chats close after 24 hours.</p></div>
        <span className={`connection-state ${connection === 'Live' ? 'connection-state--live' : ''}`}>{connection}</span>
      </div>

      {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <form className="chat-create" onSubmit={createSession}>
            <label className="field-label" htmlFor="chat-participant">Start a chat</label>
            <select id="chat-participant" value={participantId} onChange={(event) => setParticipantId(event.target.value)}><option value="">Choose a participant</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select>
            <button className="submit-btn" type="submit">Open chat</button>
          </form>
          <p className="eyebrow">Conversations</p>
          <div className="chat-session-list section-gap">
            {!sessions.length && <div className="empty-state"><strong>No chats yet</strong><span>Choose a participant to start one.</span></div>}
            {sessions.map((session) => {
              const participant = otherParticipant(session, user?.id);
              const latest = session.messages?.[0];
              return <button className="chat-session" key={session.id} type="button" aria-pressed={selectedSession?.id === session.id} onClick={() => void selectSession(session)}><strong>{participant?.name || 'Chat participant'}</strong><span className={session.status === 'OPEN' ? 'chat-session__open' : ''}>{session.status === 'OPEN' ? 'Open' : 'Closed'}{latest ? ` · ${latest.content.slice(0, 35)}` : ''}</span></button>;
            })}
          </div>
        </aside>

        <div className="chat-conversation">
          {!selectedSession && <div className="empty-state empty-state--center"><span className="panel-title-icon"><OpsIcon name="chat" /></span><strong>Choose or start a chat</strong><span>The conversation will open in this workspace.</span></div>}
          {selectedSession && <>
            <div className="chat-conversation__header"><div><strong>{otherParticipant(selectedSession, user?.id)?.name}</strong> <span className={`status-badge ${selectedSession.status === 'OPEN' ? 'status-badge--success' : ''}`}>{selectedSession.status.toLowerCase()}</span></div>{user?.role === 'admin' && selectedSession.status === 'OPEN' && <button className="action-btn" type="button" onClick={() => void closeSelectedSession()}>Close chat</button>}</div>
            <div className="chat-messages">
              {!messages.length && <div className="empty-state empty-state--center"><strong>No messages yet</strong><span>Send the first operational update below.</span></div>}
              {messages.map((message) => {
                const mine = message.senderId === user?.id;
                return <div className={`chat-bubble ${mine ? 'chat-bubble--mine' : ''}`} key={message.id}><p>{message.content}</p><small>{new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{mine && (message.readAt ? ' · Read' : ' · Sent')}</small></div>;
              })}
            </div>
            <form className="chat-compose" onSubmit={sendMessage}><input value={draft} maxLength="4000" disabled={selectedSession.status !== 'OPEN'} onChange={(event) => setDraft(event.target.value)} placeholder={selectedSession.status === 'OPEN' ? 'Type a message…' : 'This chat is closed'} /><button className="submit-btn" disabled={selectedSession.status !== 'OPEN'} type="submit">Send</button></form>
          </>}
        </div>
      </div>
    </section>
  );
}

export default ChatPanel;
