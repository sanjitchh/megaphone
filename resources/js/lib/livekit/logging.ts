import { LogLevel, setLogLevel } from 'livekit-client';

// LiveKit logs the signal-connection URL — which carries the access-token JWT —
// and connection-state churn at info/debug level. Raise the floor to `warn` so
// tokens never reach the browser console; genuine warnings and errors still
// surface. Global and idempotent: importing this for its side effect wherever a
// Room connects sets the level once, before the first connection.
setLogLevel(LogLevel.warn);
