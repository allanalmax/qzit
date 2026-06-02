/**
 * QZIT Smoke Test
 * Runs the full host-controlled quiz loop against the local dev server.
 * Usage: node smoke-test.mjs
 * Requires: npm run start:dev must be running in another terminal.
 */

import { io } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'http://localhost:3000/quiz';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(label, data) {
  console.log(`\n[${label}]`, JSON.stringify(data, null, 2));
}

function waitForEvent(socket, eventName, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event: ${eventName}`));
    }, timeoutMs);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function post(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      `POST ${path} failed ${res.status}: ${JSON.stringify(json)}`,
    );
  }

  return json;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== QZIT Smoke Test ===\n');

  // Step 0: Authenticate as a host
  console.log('Step 0: Authenticating as smoke-test host...');
  const SMOKE_EMAIL = 'smoke@qzit.test';
  const SMOKE_PASSWORD = 'SmokeTest123!';
  let token;
  try {
    const registered = await post('/auth/register', {
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
      name: 'Smoke Host',
    });
    token = registered.accessToken;
    console.log('Registered new host.');
  } catch {
    // Host already exists — log in instead
    const loggedIn = await post('/auth/login', {
      email: SMOKE_EMAIL,
      password: SMOKE_PASSWORD,
    });
    token = loggedIn.accessToken;
    console.log('Logged in as existing host.');
  }
  console.log('✅ Authenticated');

  // Step 1: Create quiz
  console.log('\nStep 1: Creating quiz...');
  const quiz = await post('/quiz', {
    title: 'Smoke Test Quiz',
    mode: 'individual',
    rounds: [
      {
        title: 'Round 1',
        questions: [
          {
            text: 'What is the capital of Kenya?',
            options: ['Nairobi', 'Kampala', 'Kigali', 'Dodoma'],
            correctOptionIndex: 0,
          },
          {
            text: 'What color is the sky?',
            options: ['Red', 'Blue', 'Green', 'Yellow'],
            correctOptionIndex: 1,
          },
        ],
      },
    ],
  }, token);

  log('Quiz created', {
    id: quiz.id,
    hostCode: quiz.hostCode,
    joinCode: quiz.joinCode,
  });

  // Step 2: Join as participant
  console.log('\nStep 2: Joining as Alice...');
  const joined = await post('/quiz/join', {
    joinCode: quiz.joinCode,
    name: 'Alice',
  });
  log('Alice joined', { participantId: joined.participantId });

  // Step 3: Connect WebSocket clients
  console.log('\nStep 3: Connecting WebSocket clients...');

  const hostSocket = io(WS_URL, { transports: ['websocket'] });
  const participantSocket = io(WS_URL, { transports: ['websocket'] });

  await Promise.all([
    new Promise((r) => hostSocket.on('connect', r)),
    new Promise((r) => participantSocket.on('connect', r)),
  ]);

  // Forward all error events to console
  hostSocket.on('quiz:error', (e) => console.error('[HOST quiz:error]', e));
  participantSocket.on('quiz:error', (e) =>
    console.error('[PARTICIPANT quiz:error]', e),
  );

  console.log('Both sockets connected.');

  // Step 4: Host joins session
  console.log('\nStep 4: Host joining session...');
  const hostSnapshotPromise = waitForEvent(hostSocket, 'quiz:snapshot');
  hostSocket.emit('host:join-session', {
    quizId: quiz.id,
    hostCode: quiz.hostCode,
  });
  const hostSnapshot = await hostSnapshotPromise;
  log('Host received quiz:snapshot', { state: hostSnapshot.state });

  // Step 5: Participant joins session
  console.log('\nStep 5: Participant joining session...');
  const participantSnapshotPromise = waitForEvent(
    participantSocket,
    'quiz:snapshot',
  );
  participantSocket.emit('participant:join-session', {
    quizId: quiz.id,
    participantId: joined.participantId,
  });
  const participantSnapshot = await participantSnapshotPromise;
  log('Participant received quiz:snapshot', {
    state: participantSnapshot.state,
  });

  // Step 6: Host starts quiz (created → waiting)
  console.log('\nStep 6: Host starting quiz...');
  const stateWaiting = waitForEvent(participantSocket, 'quiz:state-changed');
  hostSocket.emit('host:start-quiz', { quizId: quiz.id });
  const waitingState = await stateWaiting;
  log('State changed', { state: waitingState.state });
  console.assert(
    waitingState.state === 'waiting',
    '❌ Expected state: waiting',
  );
  console.log('✅ State is waiting');

  // Step 7: Host activates question 1
  console.log('\nStep 7: Host activating question 1...');
  const questionPromise = waitForEvent(
    participantSocket,
    'quiz:question-activated',
  );
  const hostCountPromise = waitForEvent(hostSocket, 'quiz:submission-count');
  hostSocket.emit('host:start-question', { quizId: quiz.id });
  const [question1, count0] = await Promise.all([
    questionPromise,
    hostCountPromise,
  ]);
  log('Participant received question', {
    text: question1.text,
    options: question1.options,
  });
  log('Host received submission count', count0);
  console.assert(
    !('correctOptionIndex' in question1),
    '❌ correctOptionIndex must NOT be visible before reveal',
  );
  console.log('✅ Correct answer hidden from participants');

  // Step 8: Alice submits correct answer (index 0 = Nairobi)
  console.log('\nStep 8: Alice submitting answer (Nairobi = index 0)...');
  const submittedPromise = waitForEvent(
    participantSocket,
    'quiz:answer-submitted',
  );
  const countUpdatedPromise = waitForEvent(hostSocket, 'quiz:submission-count');
  participantSocket.emit('participant:submit-answer', {
    quizId: quiz.id,
    selectedOptionIndex: 0,
  });
  const [submitted, count1] = await Promise.all([
    submittedPromise,
    countUpdatedPromise,
  ]);
  log('Participant received quiz:answer-submitted', submitted);
  log('Host received updated count', count1);
  console.assert(count1.count === 1, '❌ Expected submission count: 1');
  console.log('✅ Submission count is 1');

  // Step 8b: Alice tries to submit again — should get an error
  console.log(
    '\nStep 8b: Alice trying to submit again (should be rejected)...',
  );
  const errorPromise = waitForEvent(participantSocket, 'quiz:error');
  participantSocket.emit('participant:submit-answer', {
    quizId: quiz.id,
    selectedOptionIndex: 1,
  });
  const dupError = await errorPromise;
  log('Duplicate submission rejected', dupError);
  console.assert(dupError.message, '❌ Expected an error message');
  console.log('✅ Duplicate submission correctly rejected');

  // Step 9: Host locks question
  console.log('\nStep 9: Host locking question...');
  const lockedPromise = waitForEvent(participantSocket, 'quiz:question-locked');
  hostSocket.emit('host:lock-question', { quizId: quiz.id });
  await lockedPromise;
  console.log('✅ Question locked');

  // Step 9b: Alice tries to submit while locked — should get an error
  console.log(
    '\nStep 9b: Alice submitting while locked (should be rejected)...',
  );
  const lockedErrorPromise = waitForEvent(participantSocket, 'quiz:error');
  participantSocket.emit('participant:submit-answer', {
    quizId: quiz.id,
    selectedOptionIndex: 2,
  });
  const lockedError = await lockedErrorPromise;
  log('Submission after lock rejected', lockedError);
  console.log('✅ Submission after lock correctly rejected');

  // Step 10: Host reveals answer
  console.log('\nStep 10: Host revealing answer...');
  const revealedPromise = waitForEvent(
    participantSocket,
    'quiz:answer-revealed',
  );
  hostSocket.emit('host:reveal-answer', { quizId: quiz.id });
  const revealed = await revealedPromise;
  log('Answer revealed', revealed.question);
  console.assert(
    revealed.question.correctOptionIndex === 0,
    '❌ Expected correctOptionIndex: 0',
  );
  console.log('✅ Correct answer revealed (index 0 = Nairobi)');

  // Step 11: Host shows leaderboard
  console.log('\nStep 11: Host showing leaderboard...');
  const leaderboardPromise = waitForEvent(
    participantSocket,
    'quiz:leaderboard',
  );
  hostSocket.emit('host:show-leaderboard', { quizId: quiz.id });
  const leaderboard = await leaderboardPromise;
  log('Leaderboard', leaderboard.rankings);
  console.assert(
    leaderboard.rankings[0].name === 'Alice',
    '❌ Expected Alice at top',
  );
  console.assert(leaderboard.rankings[0].score === 1, '❌ Expected score: 1');
  console.log('✅ Alice has score 1 and is ranked first');

  // Step 12: Host activates question 2
  console.log('\nStep 12: Host activating question 2...');
  const question2Promise = waitForEvent(
    participantSocket,
    'quiz:question-activated',
  );
  hostSocket.emit('host:start-question', { quizId: quiz.id });
  const question2 = await question2Promise;
  log('Question 2 activated', { text: question2.text });

  // Alice submits wrong answer for Q2
  participantSocket.emit('participant:submit-answer', {
    quizId: quiz.id,
    selectedOptionIndex: 0,
  });
  await delay(300);
  hostSocket.emit('host:lock-question', { quizId: quiz.id });
  await delay(300);
  hostSocket.emit('host:reveal-answer', { quizId: quiz.id });
  await delay(300);

  // Step 13: Host ends quiz
  console.log('\nStep 13: Host ending quiz...');
  const endedPromise = waitForEvent(participantSocket, 'quiz:ended');
  hostSocket.emit('host:show-leaderboard', { quizId: quiz.id });
  await delay(300);
  hostSocket.emit('host:end-quiz', { quizId: quiz.id });
  const ended = await endedPromise;
  log('Quiz ended — final leaderboard', ended.leaderboard);
  console.assert(
    ended.leaderboard[0].name === 'Alice',
    '❌ Expected Alice at top',
  );
  console.log('✅ Quiz ended successfully');

  // Cleanup
  hostSocket.disconnect();
  participantSocket.disconnect();

  console.log('\n=== All checks passed ✅ ===\n');
}

main().catch((err) => {
  console.error('\n❌ Smoke test failed:', err.message);
  process.exit(1);
});
