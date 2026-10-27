// Public Firebase web config (safe to publish: access is enforced by firestore.rules).
export const firebaseConfig = {
  apiKey: 'AIzaSyCMo1e2HN7FE0ceXweiH5S9tcbiQwjShVk',
  authDomain: 'dalya-ulpan-911c7.firebaseapp.com',
  projectId: 'dalya-ulpan-911c7',
  appId: '1:499199017932:web:76a0f875272a3d17175369',
};

// The only account that sees the teacher board. Everyone else who signs in is a student.
export const OWNERS = ['dalya1f@gmail.com'];

export const SITE = {
  name: 'האולפן של דליה',
  tagline: 'עברית דרך טיפול באמנות',
  taglineEn: 'Hebrew through art therapy',
  teacher: 'דליה ויסברוד',
  teacherEn: 'Dalya',
};
