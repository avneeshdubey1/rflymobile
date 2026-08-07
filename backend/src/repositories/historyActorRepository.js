async function setHistoryActor(transaction, actorId) {
  if (!actorId) return;
  const normalized = String(actorId).trim();
  if (!normalized) return;
  await transaction.$queryRaw`
    SELECT set_config('rfly.actor_user_id', ${normalized}, true) AS configured_actor
  `;
}

module.exports = { setHistoryActor };
