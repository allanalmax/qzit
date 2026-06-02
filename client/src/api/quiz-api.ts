import type {
  JoinResponse,
  CreateQuizInput,
  CreateQuizResponse,
  QuizLookupResponse,
  MyQuizSummary,
} from '../types/quiz';

const BASE = '/quiz';

export async function createQuiz(
  data: CreateQuizInput,
  token: string,
): Promise<CreateQuizResponse> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Create failed' }));
    throw new Error(err.message ?? 'Create failed');
  }

  return res.json();
}

export async function joinQuiz(
  joinCode: string,
  name: string,
  teamName?: string,
): Promise<JoinResponse> {
  const body: Record<string, string> = { joinCode, name };
  if (teamName) body.teamName = teamName;

  const res = await fetch(`${BASE}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Join failed' }));
    throw new Error(err.message ?? 'Join failed');
  }

  return res.json();
}

export async function lookupQuiz(
  joinCode: string,
): Promise<QuizLookupResponse> {
  const res = await fetch(`${BASE}/lookup/${encodeURIComponent(joinCode)}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Lookup failed' }));
    throw new Error(err.message ?? 'Lookup failed');
  }

  return res.json();
}

export async function getMyQuizzes(token: string): Promise<MyQuizSummary[]> {
  const res = await fetch(`${BASE}/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ message: 'Failed to load quizzes' }));
    throw new Error(err.message ?? 'Failed to load quizzes');
  }

  return res.json();
}
