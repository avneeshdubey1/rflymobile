function schedulingTimeError(message, code = 'SCHEDULING_TIME_INVALID') {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateTimeZone(value) {
  const timeZone = String(value || '').trim();
  if (!timeZone) throw schedulingTimeError('OPERATING_TIME_ZONE is required', 'OPERATING_TIME_ZONE_REQUIRED');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
  } catch {
    throw schedulingTimeError('OPERATING_TIME_ZONE must be a valid IANA timezone', 'OPERATING_TIME_ZONE_INVALID');
  }
  return timeZone;
}

function zonedParts(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]));
  return values;
}

function addLocalDays(localDate, offset) {
  const date = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day + offset));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function instantForLocalMinutes(localDate, minutes, timeZone) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) {
    throw schedulingTimeError('Local scheduling minutes must be from 0 to 1440');
  }
  const targetDate = minutes === 1440 ? addLocalDays(localDate, 1) : localDate;
  const targetHour = minutes === 1440 ? 0 : Math.floor(minutes / 60);
  const targetMinute = minutes === 1440 ? 0 : minutes % 60;
  const desired = Date.UTC(targetDate.year, targetDate.month - 1, targetDate.day, targetHour, targetMinute, 0);
  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(new Date(candidate), timeZone);
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const adjustment = desired - represented;
    if (adjustment === 0) break;
    candidate += adjustment;
  }
  const result = new Date(candidate);
  const actual = zonedParts(result, timeZone);
  if (actual.year !== targetDate.year || actual.month !== targetDate.month || actual.day !== targetDate.day
    || actual.hour !== targetHour || actual.minute !== targetMinute) {
    throw schedulingTimeError('The configured local scheduling time does not exist in the operating timezone', 'NONEXISTENT_LOCAL_TIME');
  }
  return result;
}

function localDateForInstant(instant, timeZone) {
  const parts = zonedParts(new Date(instant), validateTimeZone(timeZone));
  return { year: parts.year, month: parts.month, day: parts.day };
}

function workingDayForOffset(now, offset, policy, timeZone) {
  const zone = validateTimeZone(timeZone);
  if (!Number.isInteger(offset) || offset < 0) throw schedulingTimeError('Scheduling day offset must be a non-negative integer');
  const localDate = addLocalDays(localDateForInstant(now, zone), offset);
  const start = instantForLocalMinutes(localDate, policy.workingDayStartMinutes, zone);
  const end = instantForLocalMinutes(localDate, policy.workingDayEndMinutes, zone);
  if (end <= start) throw schedulingTimeError('The configured working day end must be after its start');
  return { localDate, start, end, timeZone: zone };
}

module.exports = {
  addLocalDays,
  instantForLocalMinutes,
  localDateForInstant,
  validateTimeZone,
  workingDayForOffset,
  zonedParts,
};
