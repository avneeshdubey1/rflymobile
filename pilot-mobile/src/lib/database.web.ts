import {
  Assignment,
  MutationReceipt,
  MutationRequest,
} from "../contracts/mobile-api";
import type { MutationRecord } from "./database";

type WebProfileState = {
  assignments: Map<string, Assignment>;
  cursor: string;
  mutations: Map<string, MutationRecord>;
};

const profiles = new Map<string, WebProfileState>();

function stateFor(profileId: string): WebProfileState {
  let state = profiles.get(profileId);
  if (!state) {
    state = { assignments: new Map(), cursor: "", mutations: new Map() };
    profiles.set(profileId, state);
  }
  return state;
}

export function getDbName(profileId: string): string {
  return `pilot_field_${profileId.replace(/[^a-zA-Z0-9_-]/g, "")}.db`;
}

export async function initDatabase(profileId: string) {
  stateFor(profileId);
  return null;
}

export async function saveAssignments(
  profileId: string,
  assignments: Assignment[],
) {
  const state = stateFor(profileId);
  assignments.forEach((assignment) =>
    state.assignments.set(assignment.id, assignment),
  );
}

export async function getAssignments(profileId: string): Promise<Assignment[]> {
  return [...stateFor(profileId).assignments.values()].sort((left, right) =>
    left.serviceWindowStart.localeCompare(right.serviceWindowStart),
  );
}

export async function getAssignment(
  profileId: string,
  id: string,
): Promise<Assignment | null> {
  return stateFor(profileId).assignments.get(id) ?? null;
}

export async function deleteAssignments(profileId: string, ids: string[]) {
  const state = stateFor(profileId);
  ids.forEach((id) => state.assignments.delete(id));
}

export async function clearAssignments(profileId: string) {
  stateFor(profileId).assignments.clear();
}

export async function setCursor(profileId: string, cursor: string) {
  stateFor(profileId).cursor = cursor;
}

export async function getCursor(profileId: string): Promise<string> {
  return stateFor(profileId).cursor;
}

export async function insertMutation(
  profileId: string,
  mutation: MutationRequest,
) {
  const now = Date.now();
  stateFor(profileId).mutations.set(mutation.clientActionId, {
    mutation,
    status: "PENDING",
    receipt: null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getPendingMutations(
  profileId: string,
  limit = 20,
): Promise<MutationRequest[]> {
  return [...stateFor(profileId).mutations.values()]
    .filter((record) => ["PENDING", "RETRY_LATER"].includes(record.status))
    .sort((left, right) => left.createdAt - right.createdAt)
    .slice(0, limit)
    .map((record) => record.mutation);
}

export async function updateMutationStatus(
  profileId: string,
  clientActionId: string,
  status: string,
  receipt: MutationReceipt | null = null,
) {
  const record = stateFor(profileId).mutations.get(clientActionId);
  if (record) {
    stateFor(profileId).mutations.set(clientActionId, {
      ...record,
      status,
      receipt,
      updatedAt: Date.now(),
    });
  }
}

export async function getMutationRecords(
  profileId: string,
): Promise<MutationRecord[]> {
  return [...stateFor(profileId).mutations.values()].sort(
    (left, right) => right.createdAt - left.createdAt,
  );
}

export async function deleteMutation(
  profileId: string,
  clientActionId: string,
) {
  stateFor(profileId).mutations.delete(clientActionId);
}

export async function purgeDatabase(profileId: string) {
  profiles.delete(profileId);
}
