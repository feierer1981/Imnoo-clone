import { getToken } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { appCheck } from "./firebase";

/**
 * Fetch-Wrapper der automatisch Firebase Auth + App Check Token mitsendet.
 * Schützt Cloud Functions vor Fremdzugriff (curl, Bots, Scripts).
 */
export async function protectedFetch(url, body = {}) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Nicht eingeloggt.");

  const [idToken, appCheckResult] = await Promise.all([
    user.getIdToken(),
    getToken(appCheck, /* forceRefresh */ false),
  ]);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      "X-Firebase-AppCheck": appCheckResult.token,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
