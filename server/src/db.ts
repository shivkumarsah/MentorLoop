/**
 * db.ts
 *
 * lowdb-based persistence layer.
 * Uses a local JSON file (db.json, git-ignored) for zero-dependency storage.
 */

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import type { Session, MasteryMap, ConceptMastery, LearningEvent, EventType } from '../../shared/types.js';
import { initConceptMastery } from './knowledge-tracing.js';

// ---- DB Schema ---------------------------------------------

interface DbSchema {
  sessions: Record<string, Session>;
  explanationCache: Record<string, string>; // key: `${sessionId}:${concept}:${style}`
}

// ---- DB Initialization -------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '../../db.json');

let db: Low<DbSchema> | null = null;

async function getDb(): Promise<Low<DbSchema>> {
  if (!db) {
    const adapter = new JSONFile<DbSchema>(DB_PATH);
    db = new Low<DbSchema>(adapter, { sessions: {}, explanationCache: {} });
    await db.read();
    // Ensure default structure exists
    db.data ??= { sessions: {}, explanationCache: {} };
    db.data.sessions ??= {};
    db.data.explanationCache ??= {};
    await db.write();
  }
  return db;
}

// ---- Session Operations ------------------------------------

export async function createSession(
  topic: string,
  concepts: string[]
): Promise<Session> {
  const database = await getDb();

  const masteryState: MasteryMap = {};
  for (const concept of concepts) {
    masteryState[concept] = initConceptMastery(concept, 0.1);
  }

  const session: Session = {
    id: uuidv4(),
    topic,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    diagnosticComplete: false,
    concepts,
    masteryState,
    history: [],
  };

  database.data!.sessions[session.id] = session;
  await database.write();
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const database = await getDb();
  return database.data!.sessions[sessionId] ?? null;
}

export async function updateSessionMastery(
  sessionId: string,
  concept: string,
  updatedMastery: ConceptMastery
): Promise<void> {
  const database = await getDb();
  const session = database.data!.sessions[sessionId];
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.masteryState[concept] = updatedMastery;
  session.updatedAt = new Date().toISOString();
  await database.write();
}

export async function updateMasteryMap(
  sessionId: string,
  masteryMap: MasteryMap
): Promise<void> {
  const database = await getDb();
  const session = database.data!.sessions[sessionId];
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.masteryState = masteryMap;
  session.updatedAt = new Date().toISOString();
  await database.write();
}

export async function setDiagnosticComplete(sessionId: string): Promise<void> {
  const database = await getDb();
  const session = database.data!.sessions[sessionId];
  if (!session) throw new Error(`Session ${sessionId} not found`);

  session.diagnosticComplete = true;
  session.updatedAt = new Date().toISOString();
  await database.write();
}

export async function appendEvent(
  sessionId: string,
  type: EventType,
  concept: string,
  extras: Partial<LearningEvent> = {}
): Promise<void> {
  const database = await getDb();
  const session = database.data!.sessions[sessionId];
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const event: LearningEvent = {
    id: uuidv4(),
    type,
    concept,
    timestamp: new Date().toISOString(),
    ...extras,
  };

  session.history.push(event);
  session.updatedAt = new Date().toISOString();
  await database.write();
}

// ---- Explanation Cache Operations --------------------------

export async function getCachedExplanation(
  sessionId: string,
  concept: string,
  style: string
): Promise<string | null> {
  const database = await getDb();
  const key = `${sessionId}:${concept}:${style}`;
  return database.data!.explanationCache[key] ?? null;
}

export async function cacheExplanation(
  sessionId: string,
  concept: string,
  style: string,
  explanation: string
): Promise<void> {
  const database = await getDb();
  const key = `${sessionId}:${concept}:${style}`;
  database.data!.explanationCache[key] = explanation;
  await database.write();
}
