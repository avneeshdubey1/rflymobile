const chatLifecycleService = require('../services/chatLifecycleService');

function respondError(res, error) {
  const status = /not found/.test(error.message)
    ? 404
    : /not a participant|do not have permission|must be started by|Only an Admin|supervisor's first message/.test(error.message)
      ? 403
      : 400;
  return res.status(status).json({ error: error.message });
}

exports.getParticipants = async (req, res) => {
  try { return res.json({ success: true, participants: await chatLifecycleService.listParticipants(req.auth) }); }
  catch (error) { return respondError(res, error); }
};

exports.getSessions = async (req, res) => {
  try { return res.json({ success: true, sessions: await chatLifecycleService.listSessions(req.auth) }); }
  catch (error) { return respondError(res, error); }
};

exports.createSession = async (req, res) => {
  try {
    const result = await chatLifecycleService.createOrFindDirectSession(req.auth, req.body.participantId);
    return res.status(result.created ? 201 : 200).json({ success: true, ...result });
  } catch (error) { return respondError(res, error); }
};

exports.getMessages = async (req, res) => {
  try { return res.json({ success: true, ...(await chatLifecycleService.listMessages(req.params.id, req.auth)) }); }
  catch (error) { return respondError(res, error); }
};

exports.markRead = async (req, res) => {
  try { return res.json({ success: true, ...(await chatLifecycleService.markMessagesRead(req.params.id, req.auth)) }); }
  catch (error) { return respondError(res, error); }
};

exports.closeSession = async (req, res) => {
  try {
    const result = await chatLifecycleService.closeSession(req.params.id, req.auth);
    req.app.get('io')?.to(`chat:${req.params.id}`).emit('chat:closed', result);
    return res.json({ success: true, ...result });
  } catch (error) { return respondError(res, error); }
};
