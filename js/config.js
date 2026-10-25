// Public Firebase web config (safe to publish: access is enforced by firestore.rules).
export const firebaseConfig = {
  apiKey: 'FILL_ME',
  authDomain: 'FILL_ME',
  projectId: 'FILL_ME',
  appId: 'FILL_ME',
};

// The only account that sees the teacher board. Everyone else who signs in is a student.
export const OWNERS = ['dalya1f@gmail.com'];

export const SITE = {
  name: 'האולפן של דליה',
  tagline: 'עברית דרך טיפול באמנות',
  taglineEn: 'Hebrew through art therapy',
  teacher: 'דליה ויסברוד',
};
