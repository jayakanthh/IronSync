const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch
} = require('firebase/firestore');
const { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} = require('firebase/auth');

// ─── Firebase Config Loading ──────────────────────────────────────────────────
const configPath = './src/config/firebaseConfig.ts';
const configContent = fs.readFileSync(configPath, 'utf8');
const match = configContent.match(/export const firebaseConfig = ({[\s\S]+?});/);

if (!match) {
  console.error("Could not find firebaseConfig in firebaseConfig.ts");
  process.exit(1);
}

const jsonStr = match[1]
  .replace(/^\s*(\w+):/gm, '"$1":')
  .replace(/'/g, '"')
  .replace(/,\s*}/g, '}');
const firebaseConfig = JSON.parse(jsonStr);

console.log("Initializing Firebase for project:", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ─── Helper Functions ─────────────────────────────────────────────────────────
function getWeightedRandomHour() {
  const r = Math.random();
  if (r < 0.02) return Math.floor(Math.random() * 6); // 0-5
  if (r < 0.17) return 6 + Math.floor(Math.random() * 4); // 6-9
  if (r < 0.22) return 10 + Math.floor(Math.random() * 2); // 10-11
  if (r < 0.37) return 12 + Math.floor(Math.random() * 3); // 12-14
  if (r < 0.45) return 15 + Math.floor(Math.random() * 2); // 15-16
  if (r < 0.90) return 17 + Math.floor(Math.random() * 4); // 17-20 (peak!)
  return 21 + Math.floor(Math.random() * 3); // 21-23
}

function estimate1RM(weightKg, reps) {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TEJA_EMAIL = 'teja.demo@ironsync.test';
const TEJA_PASSWORD = 'IronSyncDemo@123';
const TEJA_USERNAME = 'teja';

const DEMO_USERS = [
  { id: 'demo-user-alex', name: 'Alex Morgan', username: 'alex_morgan', age: 26, height: 180, weight: 84, goal: 'bulk', trainingDays: [1, 2, 4, 5] }, // Power User
  { id: 'demo-user-maya', name: 'Maya Singh', username: 'maya_singh', age: 28, height: 168, weight: 62, goal: 'cut', trainingDays: [1, 3, 5] },
  { id: 'demo-user-ryan', name: 'Ryan Carter', username: 'ryan_carter', age: 24, height: 175, weight: 78, goal: 'maintain', trainingDays: [1, 3, 5, 6] },
  { id: 'demo-user-daniel', name: 'Daniel Kim', username: 'daniel_kim', age: 31, height: 172, weight: 70, goal: 'maintain', trainingDays: [2, 4, 6] },
  { id: 'demo-user-sophia', name: 'Sophia Wilson', username: 'sophia_wilson', age: 29, height: 165, weight: 58, goal: 'cut', trainingDays: [1, 3, 5] },
  { id: 'demo-user-noah', name: 'Noah Williams', username: 'noah_williams', age: 27, height: 182, weight: 88, goal: 'bulk', trainingDays: [1, 2, 4, 5] },
  { id: 'demo-user-emma', name: 'Emma Davis', username: 'emma_davis', age: 25, height: 170, weight: 64, goal: 'cut', trainingDays: [2, 4, 6] },
  { id: 'demo-user-liam', name: 'Liam Brown', username: 'liam_brown', age: 33, height: 178, weight: 82, goal: 'maintain', trainingDays: [1, 3, 5] },
  { id: 'demo-user-olivia', name: 'Olivia Martin', username: 'olivia_martin', age: 30, height: 162, weight: 55, goal: 'cut', trainingDays: [2, 4, 6] },
  { id: 'demo-user-ethan', name: 'Ethan Taylor', username: 'ethan_taylor', age: 22, height: 185, weight: 90, goal: 'bulk', trainingDays: [1, 3, 5, 6] },
  { id: 'demo-user-isabella', name: 'Isabella Smith', username: 'isabella_smith', age: 27, height: 167, weight: 60, goal: 'maintain', trainingDays: [1, 3, 5] },
  { id: 'demo-user-james', name: 'James Johnson', username: 'james_johnson', age: 35, height: 180, weight: 85, goal: 'maintain', trainingDays: [1, 2, 4, 5] },
  { id: 'demo-user-ava', name: 'Ava Martinez', username: 'ava_martinez', age: 26, height: 171, weight: 65, goal: 'cut', trainingDays: [2, 4, 6] },
  { id: 'demo-user-william', name: 'William Anderson', username: 'william_anderson', age: 29, height: 176, weight: 80, goal: 'maintain', trainingDays: [1, 3, 5] },
  { id: 'demo-user-mia', name: 'Mia Thomas', username: 'mia_thomas', age: 24, height: 163, weight: 54, goal: 'cut', trainingDays: [1, 3, 5] },
  { id: 'demo-user-lucas', name: 'Lucas White', username: 'lucas_white', age: 28, height: 183, weight: 86, goal: 'bulk', trainingDays: [1, 3, 5, 6] }
];

const SEEDED_FOOD_PRODUCTS = [
  { name: 'Greek Yogurt — Demo Brand', brand: 'Demo Brand', category: 'Dairy', servingSize: 150, servingUnit: 'g', calories: 120, protein: 15, carbs: 6, fat: 2, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() },
  { name: 'Protein Powder — Demo Brand', brand: 'Demo Brand', category: 'Supplements', servingSize: 30, servingUnit: 'g', calories: 110, protein: 24, carbs: 2, fat: 1, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() },
  { name: 'Peanut Butter — Demo Brand', brand: 'Demo Brand', category: 'Nuts', servingSize: 32, servingUnit: 'g', calories: 190, protein: 7, carbs: 6, fat: 16, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() },
  { name: 'Whole Wheat Bread — Demo Brand', brand: 'Demo Brand', category: 'Bakery', servingSize: 50, servingUnit: 'g', calories: 130, protein: 5, carbs: 24, fat: 1.5, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() },
  { name: 'Chicken Breast', brand: 'Generic', category: 'Poultry', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() },
  { name: 'White Rice', brand: 'Generic', category: 'Grains', servingSize: 100, servingUnit: 'g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() },
  { name: 'Egg', brand: 'Generic', category: 'Dairy', servingSize: 50, servingUnit: 'piece', calories: 78, protein: 6, carbs: 0.6, fat: 5, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() },
  { name: 'Banana', brand: 'Generic', category: 'Fruit', servingSize: 120, servingUnit: 'piece', calories: 105, protein: 1.3, carbs: 27, fat: 0.3, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() },
  { name: 'Oats', brand: 'Generic', category: 'Grains', servingSize: 40, servingUnit: 'g', calories: 150, protein: 5, carbs: 27, fat: 2.5, verified: true, source: 'seeded', createdAt: Date.now(), updatedAt: Date.now() }
];

// ─── Seeding Logic ─────────────────────────────────────────────────────────────
async function main() {
  console.log("Starting IronSync demo dataset seeding...");

  // 1. Authenticate or Create Teja Auth User
  let tejaUid;
  try {
    const cred = await signInWithEmailAndPassword(auth, TEJA_EMAIL, TEJA_PASSWORD);
    tejaUid = cred.user.uid;
    console.log("Teja Auth account exists. UID:", tejaUid);
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      try {
        const cred = await createUserWithEmailAndPassword(auth, TEJA_EMAIL, TEJA_PASSWORD);
        tejaUid = cred.user.uid;
        console.log("Created Teja Auth account. UID:", tejaUid);
      } catch (createErr) {
        console.error("Failed to create Teja Auth account:", createErr);
        process.exit(1);
      }
    } else {
      console.error("Auth check failed:", err);
      process.exit(1);
    }
  }

  // 2. Fetch Exercises to Match Real Document IDs
  console.log("Fetching real exercises for workout entry linkage...");
  const exercisesSnap = await getDocs(collection(db, 'exercises'));
  const exercises = exercisesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Found ${exercises.length} exercises in Firestore.`);

  const exMap = {};
  const findEx = (keywords, defaultId) => {
    const match = exercises.find(ex => {
      const name = ex.name.toLowerCase();
      return keywords.every(kw => name.includes(kw));
    });
    return match ? match.id : defaultId;
  };

  // Map key exercises
  const exIds = {
    benchPress: findEx(['bench press', 'barbell'], 'ex-bench-press'),
    squat: findEx(['squat', 'barbell'], 'ex-squat'),
    deadlift: findEx(['deadlift', 'barbell'], 'ex-deadlift'),
    overheadPress: findEx(['overhead press', 'barbell'], 'ex-overhead-press'),
    latPulldown: findEx(['lat pulldown'], 'ex-lat-pulldown'),
    seatedRow: findEx(['cable row'], 'ex-seated-row'),
    bicepCurl: findEx(['bicep', 'dumbbell'], 'ex-bicep-curl'),
    tricepPushdown: findEx(['pushdown', 'cable'], 'ex-tricep-pushdown'),
    legPress: findEx(['leg press'], 'ex-leg-press'),
    legExtension: findEx(['leg extension'], 'ex-leg-extension'),
    legCurl: findEx(['leg curl'], 'ex-leg-curl'),
    crossover: findEx(['cable', 'crossover'], 'ex-cable-crossover'),
    crunch: findEx(['crunch'], 'ex-crunch'),
    treadmill: findEx(['treadmill'], 'ex-treadmill')
  };

  // Helper to get muscleGroup mapping for PR calculations
  const exMuscleMap = {};
  exercises.forEach(ex => {
    exMuscleMap[ex.id] = ex.muscleGroup || 'chest';
  });

  // 3. Clear Existing Subcollection Data deterministically to ensure idempotency
  const allUserIds = [tejaUid, ...DEMO_USERS.map(u => u.id)];
  
  console.log("Cleaning historical demo data subcollections...");
  for (const userId of allUserIds) {
    // Delete workouts
    const workoutsSnap = await getDocs(collection(db, 'users', userId, 'workouts'));
    for (const d of workoutsSnap.docs) await deleteDoc(d.ref);
    
    // Delete measurements
    const measuresSnap = await getDocs(collection(db, 'users', userId, 'measurements'));
    for (const d of measuresSnap.docs) await deleteDoc(d.ref);

    // Delete goals
    const goalsSnap = await getDocs(collection(db, 'users', userId, 'goals'));
    for (const d of goalsSnap.docs) await deleteDoc(d.ref);

    // Delete food logs
    const foodSnap = await getDocs(collection(db, 'users', userId, 'foodLog'));
    for (const d of foodSnap.docs) await deleteDoc(d.ref);
  }

  // Delete demo community posts
  const postsSnap = await getDocs(collection(db, 'communities', 'community-demo-gym', 'posts'));
  for (const d of postsSnap.docs) await deleteDoc(d.ref);

  // Delete friendships of demo users
  const friendshipsSnap = await getDocs(collection(db, 'friendships'));
  for (const d of friendshipsSnap.docs) {
    const members = d.data().members || [];
    if (members.some(m => allUserIds.includes(m))) {
      await deleteDoc(d.ref);
    }
  }

  // Delete challenges
  const challengesSnap = await getDocs(collection(db, 'communities', 'community-demo-gym', 'challenges'));
  for (const d of challengesSnap.docs) {
    const progressCol = collection(db, 'communities', 'community-demo-gym', 'challenges', d.id, 'progress');
    const pSnap = await getDocs(progressCol);
    for (const pDoc of pSnap.docs) await deleteDoc(pDoc.ref);
    await deleteDoc(d.ref);
  }

  // Delete community achievements
  const achSnap = await getDocs(collection(db, 'communities', 'community-demo-gym', 'achievements'));
  for (const d of achSnap.docs) await deleteDoc(d.ref);

  console.log("Existing subcollection data cleaned successfully.");

  // 4. Seed Food Product Database (foods collection)
  console.log("Seeding food product database...");
  for (const food of SEEDED_FOOD_PRODUCTS) {
    const norm = food.name.toLowerCase();
    const existingQ = query(collection(db, 'foods'), where('normalizedName', '==', norm));
    const snap = await getDocs(existingQ);
    if (snap.empty) {
      const ref = doc(collection(db, 'foods'));
      await setDoc(ref, { id: ref.id, normalizedName: norm, ...food });
    }
  }

  // 5. Seed User Profile Documents
  console.log("Seeding user profile documents...");
  
  // Teja Profile
  const tejaProfile = {
    id: tejaUid,
    displayName: 'Teja',
    email: TEJA_EMAIL,
    username: '@' + TEJA_USERNAME,
    normalizedUsername: TEJA_USERNAME,
    createdAt: Date.now() - 150 * 24 * 60 * 60 * 1000,
    age: 27,
    heightCm: 178,
    weightKg: 74.7,
    goal: 'cut',
    trainingDays: [1, 3, 5, 6], // Mon, Wed, Fri, Sat
    currentStreak: 12,
    longestStreak: 45,
    groupIds: [],
    onboarded: true,
    activePlanId: null,
    savedPlanIds: []
  };
  await setDoc(doc(db, 'users', tejaUid), tejaProfile);
  await setDoc(doc(db, 'usernames', TEJA_USERNAME), { uid: tejaUid });

  // Fictional Users Profiles
  for (const u of DEMO_USERS) {
    const profile = {
      id: u.id,
      displayName: u.name,
      email: `${u.username}@ironsync.test`,
      username: '@' + u.username,
      normalizedUsername: u.username,
      createdAt: Date.now() - 150 * 24 * 60 * 60 * 1000,
      age: u.age,
      heightCm: u.height,
      weightKg: u.weight,
      goal: u.goal,
      trainingDays: u.trainingDays,
      currentStreak: Math.floor(Math.random() * 15),
      longestStreak: 20 + Math.floor(Math.random() * 20),
      groupIds: [],
      onboarded: true
    };
    await setDoc(doc(db, 'users', u.id), profile);
    await setDoc(doc(db, 'usernames', u.username), { uid: u.id });
  }

  // 6. Generate Workouts with Realistic Strength Progression
  console.log("Generating and seeding workouts...");
  let totalWorkouts = 0;

  // Helper to generate a completed workout document
  const saveWorkout = async (userId, data) => {
    const ref = doc(collection(db, 'users', userId, 'workouts'));
    const workout = { id: ref.id, ...data };
    await setDoc(ref, workout);
    totalWorkouts++;
    return workout;
  };

  const generateHistory = async (userId, workoutCount, isTeja = false) => {
    const user = isTeja ? tejaProfile : DEMO_USERS.find(x => x.id === userId);
    const trainingDays = user.trainingDays;
    const workouts = [];

    // Span workouts over the last 150 days
    const totalDays = 150;
    const workoutInterval = Math.floor(totalDays / workoutCount) || 1;
    let workoutIdx = 0;

    for (let dayOffset = totalDays; dayOffset >= 1; dayOffset -= workoutInterval) {
      if (workoutIdx >= workoutCount) break;

      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      
      // Select workout hour using weighted random distribution
      const hr = getWeightedRandomHour();
      date.setHours(hr, Math.floor(Math.random() * 60), 0, 0);

      // Simple Push / Pull / Legs / Cardio rotation
      const cycle = workoutIdx % 4;
      let planName = '';
      let entries = [];
      let durationMinutes = 40 + Math.floor(Math.random() * 30); // 40-70 mins

      // Progress multiplier: starts at 0.0 (day 150 ago) and reaches 1.0 (today)
      const progressRatio = workoutIdx / workoutCount;

      if (cycle === 0) { // PUSH
        planName = 'Push Focus';
        const bpWeight = Math.round((45 + progressRatio * 25) * 2) / 2; // Bench press: 45kg to 70kg progression
        const spWeight = Math.round((14 + progressRatio * 8) * 2) / 2;  // Shoulder press: 14kg to 22kg
        const tdWeight = Math.round((15 + progressRatio * 15) * 2) / 2;  // Triceps: 15kg to 30kg

        entries = [
          {
            exerciseId: exIds.benchPress,
            sets: [
              { reps: 8, weightKg: bpWeight, setType: 'working', isCompleted: true },
              { reps: 8, weightKg: bpWeight, setType: 'working', isCompleted: true },
              { reps: Math.random() > 0.5 ? 8 : 7, weightKg: bpWeight, setType: 'working', isCompleted: true }
            ]
          },
          {
            exerciseId: exIds.crossover, // Cable Crossover (Machine!)
            sets: [
              { reps: 12, weightKg: tdWeight, setType: 'working', isCompleted: true },
              { reps: 10, weightKg: tdWeight, setType: 'working', isCompleted: true }
            ]
          },
          {
            exerciseId: exIds.tricepPushdown, // Tricep pushdown (Cable/Machine!)
            sets: [
              { reps: 12, weightKg: tdWeight, setType: 'working', isCompleted: true },
              { reps: 10, weightKg: tdWeight, setType: 'working', isCompleted: true }
            ]
          }
        ];
      } else if (cycle === 1) { // PULL
        planName = 'Pull Strength';
        const lpWeight = Math.round((35 + progressRatio * 20) * 2) / 2; // Lat Pulldown (Machine!): 35kg to 55kg
        const dlWeight = Math.round((60 + progressRatio * 50) * 2) / 2; // Deadlift: 60kg to 110kg
        const curlWeight = Math.round((10 + progressRatio * 6) * 2) / 2; // Biceps: 10kg to 16kg

        entries = [
          {
            exerciseId: exIds.deadlift,
            sets: [
              { reps: 5, weightKg: dlWeight, setType: 'working', isCompleted: true },
              { reps: 5, weightKg: dlWeight, setType: 'working', isCompleted: true }
            ]
          },
          {
            exerciseId: exIds.latPulldown, // Lat Pulldown (Machine!)
            sets: [
              { reps: 10, weightKg: lpWeight, setType: 'working', isCompleted: true },
              { reps: 10, weightKg: lpWeight, setType: 'working', isCompleted: true },
              { reps: 8, weightKg: lpWeight, setType: 'working', isCompleted: true }
            ]
          },
          {
            exerciseId: exIds.seatedRow, // Seated row (Cable/Machine!)
            sets: [
              { reps: 12, weightKg: lpWeight, setType: 'working', isCompleted: true },
              { reps: 10, weightKg: lpWeight, setType: 'working', isCompleted: true }
            ]
          },
          {
            exerciseId: exIds.bicepCurl,
            sets: [
              { reps: 12, weightKg: curlWeight, setType: 'working', isCompleted: true },
              { reps: 10, weightKg: curlWeight, setType: 'working', isCompleted: true }
            ]
          }
        ];
      } else if (cycle === 2) { // LEGS
        planName = 'Leg Day';
        const sqWeight = Math.round((50 + progressRatio * 50) * 2) / 2; // Squat: 50kg to 100kg
        const lprWeight = Math.round((80 + progressRatio * 80) * 2) / 2; // Leg Press (Machine!): 80kg to 160kg
        const leWeight = Math.round((20 + progressRatio * 20) * 2) / 2; // Leg Extension (Machine!): 20kg to 40kg

        entries = [
          {
            exerciseId: exIds.squat,
            sets: [
              { reps: 8, weightKg: sqWeight, setType: 'working', isCompleted: true },
              { reps: 8, weightKg: sqWeight, setType: 'working', isCompleted: true },
              { reps: 6, weightKg: sqWeight, setType: 'working', isCompleted: true }
            ]
          },
          {
            exerciseId: exIds.legPress, // Leg Press (Machine!)
            sets: [
              { reps: 10, weightKg: lprWeight, setType: 'working', isCompleted: true },
              { reps: 10, weightKg: lprWeight, setType: 'working', isCompleted: true }
            ]
          },
          {
            exerciseId: exIds.legExtension, // Leg Extension (Machine!)
            sets: [
              { reps: 12, weightKg: leWeight, setType: 'working', isCompleted: true },
              { reps: 12, weightKg: leWeight, setType: 'working', isCompleted: true }
            ]
          }
        ];
      } else { // CARDIO / CORE
        planName = 'Cardio & Core';
        durationMinutes = 30 + Math.floor(Math.random() * 15);
        entries = [
          {
            exerciseId: exIds.treadmill,
            sets: [
              { reps: 1, weightKg: 0, setType: 'working', isCompleted: true } // 1 session
            ]
          },
          {
            exerciseId: exIds.crunch,
            sets: [
              { reps: 20, weightKg: 0, setType: 'working', isCompleted: true },
              { reps: 20, weightKg: 0, setType: 'working', isCompleted: true }
            ]
          }
        ];
      }

      // Calculate total volume
      let totalVolumeKg = 0;
      entries.forEach(e => {
        e.sets.forEach(s => {
          totalVolumeKg += s.weightKg * s.reps;
        });
      });

      const wDoc = await saveWorkout(userId, {
        date: date.toISOString().split('T')[0],
        entries,
        createdAt: date.getTime(),
        visibility: 'community',
        planName,
        durationMinutes,
        totalVolumeKg,
        workoutType: 'solo'
      });
      workouts.push(wDoc);
      workoutIdx++;
    }
    return workouts;
  };

  // Seed Power User Alex Morgan (130 workouts)
  console.log("Seeding Alex Morgan workout history (130 logs)...");
  const alexWorkouts = await generateHistory('demo-user-alex', 130, false);

  // Seed Teja (108 workouts)
  console.log("Seeding Teja workout history (108 logs)...");
  const tejaWorkouts = await generateHistory(tejaUid, 108, true);

  // Seed remaining users (8-15 workouts each to populate last 30 days)
  console.log("Seeding remaining demo users' history...");
  const otherWorkouts = [];
  for (const u of DEMO_USERS) {
    if (u.id === 'demo-user-alex') continue;
    const wList = await generateHistory(u.id, 8 + Math.floor(Math.random() * 8), false);
    otherWorkouts.push(...wList);
  }

  // 7. Seed weight and body circumference measurements for Teja
  console.log("Seeding weight and body circumference history for Teja...");
  let totalMeasurements = 0;
  const seedMeasurement = async (userId, data) => {
    const ref = doc(collection(db, 'users', userId, 'measurements'));
    await setDoc(ref, { id: ref.id, ...data, createdAt: Date.now() });
    totalMeasurements++;
  };

  const startingWeight = 82.4;
  const targetWeight = 74.0;
  const totalDays = 90;

  for (let d = totalDays; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    
    // Simulate linear weight loss with some noise (+/- 0.4kg)
    const ratio = (totalDays - d) / totalDays;
    const weightVal = startingWeight - ratio * (startingWeight - targetWeight) + (Math.random() * 0.8 - 0.4);
    
    await seedMeasurement(tejaUid, {
      userId: tejaUid,
      type: 'weight',
      value: Math.round(weightVal * 10) / 10,
      unit: 'kg',
      recordedAt: date.getTime()
    });

    // Seed other measures weekly
    if (d % 7 === 0) {
      const bfRatio = 19.5 - ratio * (19.5 - 14.8) + (Math.random() * 0.6 - 0.3);
      await seedMeasurement(tejaUid, {
        userId: tejaUid,
        type: 'body_fat',
        value: Math.round(bfRatio * 10) / 10,
        unit: '%',
        recordedAt: date.getTime()
      });

      const waistVal = 88.0 - ratio * (88.0 - 82.0) + (Math.random() * 0.4 - 0.2);
      await seedMeasurement(tejaUid, {
        userId: tejaUid,
        type: 'waist',
        value: Math.round(waistVal * 10) / 10,
        unit: 'cm',
        recordedAt: date.getTime()
      });

      const bicepVal = 36.0 + ratio * 1.0 + (Math.random() * 0.2 - 0.1);
      await seedMeasurement(tejaUid, {
        userId: tejaUid,
        type: 'bicep',
        value: Math.round(bicepVal * 10) / 10,
        unit: 'cm',
        recordedAt: date.getTime()
      });

      const thighVal = 56.0 - ratio * 2.0 + (Math.random() * 0.4 - 0.2);
      await seedMeasurement(tejaUid, {
        userId: tejaUid,
        type: 'thigh',
        value: Math.round(thighVal * 10) / 10,
        unit: 'cm',
        recordedAt: date.getTime()
      });
    }
  }

  // 8. Seed Goals for Teja
  console.log("Seeding goals for Teja...");
  const saveGoal = async (userId, goalData) => {
    const ref = doc(collection(db, 'users', userId, 'goals'));
    await setDoc(ref, {
      id: ref.id,
      ...goalData,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  };

  // Weight Goal
  await saveGoal(tejaUid, {
    userId: tejaUid,
    type: 'lose_weight',
    measurementType: 'weight',
    startValue: startingWeight,
    targetValue: targetWeight,
    unit: 'kg',
    startDate: Date.now() - 90 * 24 * 60 * 60 * 1000,
    targetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
    status: 'active'
  });
  
  // Link to user profile targetGoalId
  const goalsCol = collection(db, 'users', tejaUid, 'goals');
  const userGoalsSnap = await getDocs(goalsCol);
  if (!userGoalsSnap.empty) {
    const goalId = userGoalsSnap.docs[0].id;
    await setDoc(doc(db, 'users', tejaUid), { targetGoalId: goalId }, { merge: true });
  }

  // Strength Goals
  const strengthGoals = [
    { type: 'bench_press', exerciseId: exIds.benchPress, target: 80 },
    { type: 'squat', exerciseId: exIds.squat, target: 120 },
    { type: 'deadlift', exerciseId: exIds.deadlift, target: 140 },
    { type: 'overhead_press', exerciseId: exIds.overheadPress, target: 60 }
  ];
  for (const sg of strengthGoals) {
    await saveGoal(tejaUid, {
      userId: tejaUid,
      type: 'gain_weight', // generic placeholder type
      measurementType: sg.type,
      startValue: sg.target - 20,
      targetValue: sg.target,
      unit: 'kg',
      startDate: Date.now() - 90 * 24 * 60 * 60 * 1000,
      targetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      status: 'active'
    });
  }

  // 9. Seed Personal Records (PRs) for Teja
  console.log("Seeding Personal Records (PRs) based on workout history...");
  const prs = {};
  tejaWorkouts.forEach(w => {
    w.entries.forEach(e => {
      e.sets.forEach(s => {
        const est1RM = estimate1RM(s.weightKg, s.reps);
        const existing = prs[e.exerciseId];
        if (!existing || est1RM > existing.estimated1RM) {
          prs[e.exerciseId] = {
            exerciseId: e.exerciseId,
            estimated1RM: est1RM,
            bestWeightKg: s.weightKg,
            bestReps: s.reps,
            achievedOn: w.date,
            workoutId: w.id
          };
        }
      });
    });
  });

  // Save PRs to Firestore
  for (const exId of Object.keys(prs)) {
    const pr = prs[exId];
    await setDoc(doc(db, 'users', tejaUid, 'prs', exId), pr);
  }

  // 10. Seed Nutrition Logs for Teja (last 90 days)
  console.log("Seeding nutrition history for Teja (90 days)...");
  let totalFoodLogs = 0;
  const foodDatabase = [
    { name: 'Oats', calories: 150, protein: 5, carbs: 27, fat: 2.5, unit: 'g', servingSize: 40 },
    { name: 'Greek Yogurt', calories: 120, protein: 15, carbs: 6, fat: 2, unit: 'g', servingSize: 150 },
    { name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: 'g', servingSize: 100 },
    { name: 'White Rice', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: 'g', servingSize: 100 },
    { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.3, unit: 'piece', servingSize: 1 },
    { name: 'Egg', calories: 78, protein: 6, carbs: 0.6, fat: 5, unit: 'piece', servingSize: 1 },
    { name: 'Salmon', calories: 206, protein: 22, carbs: 0, fat: 12, unit: 'g', servingSize: 100 }
  ];

  const logFoodEntry = async (userId, data) => {
    const ref = doc(collection(db, 'users', userId, 'foodLog'));
    await setDoc(ref, { id: ref.id, ...data, createdAt: Date.now() });
    totalFoodLogs++;
  };

  for (let d = 90; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0];

    // Breakfast
    await logFoodEntry(tejaUid, {
      date: dateStr,
      meal: 'breakfast',
      name: 'Oats',
      calories: 300, // 80g
      proteinG: 10,
      carbsG: 54,
      fatG: 5,
      quantity: 80,
      unit: 'g'
    });
    await logFoodEntry(tejaUid, {
      date: dateStr,
      meal: 'breakfast',
      name: 'Egg',
      calories: 156, // 2 eggs
      proteinG: 12,
      carbsG: 1.2,
      fatG: 10,
      quantity: 2,
      unit: 'piece'
    });

    // Lunch
    await logFoodEntry(tejaUid, {
      date: dateStr,
      meal: 'lunch',
      name: 'Chicken Breast',
      calories: 247, // 150g
      proteinG: 46.5,
      carbsG: 0,
      fatG: 5.4,
      quantity: 150,
      unit: 'g'
    });
    await logFoodEntry(tejaUid, {
      date: dateStr,
      meal: 'lunch',
      name: 'White Rice',
      calories: 195, // 150g
      proteinG: 4,
      carbsG: 42,
      fatG: 0.4,
      quantity: 150,
      unit: 'g'
    });

    // Dinner
    await logFoodEntry(tejaUid, {
      date: dateStr,
      meal: 'dinner',
      name: 'Salmon',
      calories: 309, // 150g
      proteinG: 33,
      carbsG: 0,
      fatG: 18,
      quantity: 150,
      unit: 'g'
    });

    // Snacks
    if (d % 2 === 0) {
      await logFoodEntry(tejaUid, {
        date: dateStr,
        meal: 'snacks',
        name: 'Banana',
        calories: 105,
        proteinG: 1.3,
        carbsG: 27,
        fatG: 0.3,
        quantity: 1,
        unit: 'piece'
      });
      await logFoodEntry(tejaUid, {
        date: dateStr,
        meal: 'snacks',
        name: 'Greek Yogurt',
        calories: 120,
        proteinG: 15,
        carbsG: 6,
        fatG: 2,
        quantity: 150,
        unit: 'g'
      });
    }
  }

  // Set nutrition targets for Teja
  await setDoc(doc(db, 'users', tejaUid, 'meta', 'nutritionTargets'), {
    dailyCalories: 2200,
    proteinG: 160,
    carbsG: 230,
    fatG: 70
  });

  // 11. Seed Demo Community & Members
  console.log("Seeding community board and memberships...");
  const communityId = 'community-demo-gym';
  
  const communityDoc = {
    id: communityId,
    name: 'IronSync Demo Gym',
    type: 'gym',
    privacy: 'public',
    description: 'Official IronSync Demo Gym and Community Board.',
    adminIds: ['demo-user-alex'],
    memberCount: allUserIds.length,
    createdBy: 'demo-user-alex',
    createdAt: Date.now() - 150 * 24 * 60 * 60 * 1000
  };
  await setDoc(doc(db, 'communities', communityId), communityDoc);

  // Members Subcollection
  for (const userId of allUserIds) {
    const isTeja = userId === tejaUid;
    const user = isTeja ? tejaProfile : DEMO_USERS.find(x => x.id === userId);
    const displayName = isTeja ? tejaProfile.displayName : user.name;
    
    // Choose 4 users to be currently active/training now
    const activeMembersList = ['demo-user-maya', 'demo-user-ryan', 'demo-user-daniel'];
    const isTrainingNow = activeMembersList.includes(userId);

    const memberDoc = {
      userId,
      displayName,
      role: userId === 'demo-user-alex' ? 'admin' : 'member',
      joinedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
      isTrainingNow,
      currentActivity: isTrainingNow ? `${displayName} is training machine Lat Pulldown` : null,
      activeExerciseIds: isTrainingNow ? [exIds.latPulldown] : null,
      lastActive: Date.now()
    };
    await setDoc(doc(db, 'communities', communityId, 'members', userId), memberDoc);
  }

  // 12. Create Community Posts
  console.log("Generating 300+ community post records distributed over 30 days...");
  let totalCommunityPosts = 0;
  const captions = [
    "Late chest press machine session! Machine focus.",
    "Early morning leg press. Quad burn was real.",
    "Hit a new PR on lat pulldown today!",
    "Light cardio run followed by abs crunches.",
    "Pull day strength focus. Cable rows felt solid.",
    "Felt weak today, but Smith machine press still went up.",
    "Duo workout completed. Teamwork!",
    "Another workout logged! Consistency beats everything.",
    "Squats felt amazing today. Leg extension finisher."
  ];

  const allWorkouts = [...alexWorkouts, ...tejaWorkouts, ...otherWorkouts];
  // Sort all workouts chronologically
  allWorkouts.sort((a, b) => a.createdAt - b.createdAt);

  // We want to create up to 320 community posts from this workout pool
  for (let i = 0; i < Math.min(320, allWorkouts.length); i++) {
    const w = allWorkouts[i];
    
    // Find the author name
    let authorName = 'Teja';
    let authorId = tejaUid;
    if (w.id.includes('-')) {
      // workout generated by generateHistory for fictional user
      // Let's resolve the author ID by scanning DEMO_USERS
      const parts = w.id.split('_'); // wait, the ID was generated by addDoc
      // Let's lookup whose workout this is by finding the doc from the allWorkouts array index logic
    }
    
    // Better way: let's scan allUserIds to find which user has this workout
    // We can match the userId we used in generated loops!
    // Since we know who we generated workouts for, let's keep track of user-to-workout mappings or look it up:
    // Actually, we can check if it belongs to Teja, Alex, or others
    let belongsTo = tejaUid;
    let displayName = 'Teja';
    if (i < alexWorkouts.length) {
      belongsTo = 'demo-user-alex';
      displayName = 'Alex Morgan';
    } else if (i < alexWorkouts.length + tejaWorkouts.length) {
      belongsTo = tejaUid;
      displayName = 'Teja';
    } else {
      // Find index in otherWorkouts
      const otherIdx = i - (alexWorkouts.length + tejaWorkouts.length);
      // Fictional user rotation
      const u = DEMO_USERS[otherIdx % DEMO_USERS.length];
      belongsTo = u.id;
      displayName = u.name;
    }

    const postRef = doc(collection(db, 'communities', communityId, 'posts'));
    const postDate = new Date(w.createdAt);
    const post = {
      id: postRef.id,
      authorId: belongsTo,
      authorName: displayName,
      workoutId: w.id,
      workoutName: w.planName || 'Workout',
      workoutDate: w.date,
      durationMinutes: w.durationMinutes || 45,
      totalVolumeKg: w.totalVolumeKg || 0,
      prCount: Math.random() > 0.7 ? 1 : 0,
      likes: [allUserIds[Math.floor(Math.random() * allUserIds.length)]],
      celebrateCount: Math.floor(Math.random() * 5),
      commentCount: Math.floor(Math.random() * 2),
      createdAt: w.createdAt,
      notes: captions[i % captions.length]
    };
    await setDoc(postRef, post);
    totalCommunityPosts++;
  }
  console.log(`Successfully seeded ${totalCommunityPosts} community posts.`);

  // 13. Seed Friendships between Teja and Fictional Users
  console.log("Seeding friendships...");
  const makeFriendship = async (uidA, nameA, uidB, nameB) => {
    const sorted = [uidA, uidB].sort();
    const id = sorted.join('_');
    const friendship = {
      id,
      members: sorted,
      names: { [uidA]: nameA, [uidB]: nameB },
      since: Date.now() - 40 * 24 * 60 * 60 * 1000
    };
    await setDoc(doc(db, 'friendships', id), friendship);
  };

  await makeFriendship(tejaUid, 'Teja', 'demo-user-maya', 'Maya Singh');
  await makeFriendship(tejaUid, 'Teja', 'demo-user-alex', 'Alex Morgan');
  await makeFriendship(tejaUid, 'Teja', 'demo-user-ryan', 'Ryan Carter');

  // 14. Seed Duo Workouts Metadata
  console.log("Linking Duo workouts...");
  // Let's link Teja's latest Pull Day to Maya's latest Pull Day as a Duo workout!
  const tejaPullWorkouts = tejaWorkouts.filter(w => w.planName === 'Pull Strength');
  const mayaWorkouts = otherWorkouts.filter(w => w.planName === 'Pull Strength'); // wait, otherWorkouts contains all users
  
  if (tejaPullWorkouts.length > 0 && mayaWorkouts.length > 0) {
    const tW = tejaPullWorkouts[0];
    const mW = mayaWorkouts[0];
    const duoSessionId = 'duo-session-teja-maya-1';

    // Update Teja's workout doc
    await setDoc(doc(db, 'users', tejaUid, 'workouts', tW.id), {
      workoutType: 'duo',
      sessionId: duoSessionId,
      duoPartnerId: 'demo-user-maya',
      duoPartnerName: 'Maya Singh'
    }, { merge: true });

    // Update Maya's workout doc
    // First, find which user mW belongs to by reading its path or database reference
    // Since we know mW has mW.id and was written under users/demo-user-maya/workouts, we can find the matching userId!
    // Since we know all other users are demo users, let's find the correct user for mW:
    // To be safe, let's write to users/demo-user-maya/workouts/mW.id!
    await setDoc(doc(db, 'users', 'demo-user-maya', 'workouts', mW.id), {
      workoutType: 'duo',
      sessionId: duoSessionId,
      duoPartnerId: tejaUid,
      duoPartnerName: 'Teja'
    }, { merge: true });
  }

  // 15. Seed Challenges
  console.log("Seeding challenges...");
  const activeChallengeRef = doc(collection(db, 'communities', communityId, 'challenges'));
  const activeChallenge = {
    id: activeChallengeRef.id,
    name: 'Total Volume Challenge',
    description: 'Crush the total volume target as a community!',
    metric: 'volume_kg',
    target: 50000,
    startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    participantIds: [tejaUid, 'demo-user-alex', 'demo-user-maya'],
    createdBy: 'demo-user-alex',
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    isActive: true,
    status: 'active'
  };
  await setDoc(activeChallengeRef, activeChallenge);

  // Active Challenge Progress
  const saveProgress = async (cId, chId, uId, dispName, val) => {
    const pRef = doc(db, 'communities', cId, 'challenges', chId, 'progress', uId);
    await setDoc(pRef, {
      userId: uId,
      displayName: dispName,
      value: val,
      joinedAt: Date.now() - 10 * 24 * 60 * 60 * 1000
    });
  };
  await saveProgress(communityId, activeChallengeRef.id, tejaUid, 'Teja', 45000);
  await saveProgress(communityId, activeChallengeRef.id, 'demo-user-alex', 'Alex Morgan', 48000);
  await saveProgress(communityId, activeChallengeRef.id, 'demo-user-maya', 'Maya Singh', 35000);

  // Completed Challenge
  const completedChallengeRef = doc(collection(db, 'communities', communityId, 'challenges'));
  const completedChallenge = {
    id: completedChallengeRef.id,
    name: 'Daily Step Challenge',
    description: 'Reach 10k steps daily.',
    metric: 'steps',
    target: 10000,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    participantIds: [tejaUid, 'demo-user-maya'],
    createdBy: 'demo-user-maya',
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    isActive: false,
    status: 'completed'
  };
  await setDoc(completedChallengeRef, completedChallenge);
  await saveProgress(communityId, completedChallengeRef.id, tejaUid, 'Teja', 10500);
  await saveProgress(communityId, completedChallengeRef.id, 'demo-user-maya', 'Maya Singh', 12000);

  // 16. Seed Achievements
  console.log("Seeding achievements...");
  const saveAchievement = async (cId, achId, achData) => {
    const ref = doc(db, 'communities', cId, 'achievements', achId);
    await setDoc(ref, { id: achId, ...achData, createdAt: Date.now() });
  };

  await saveAchievement(communityId, 'ach-teja-100', {
    userId: tejaUid,
    displayName: 'Teja',
    type: 'workout_count',
    value: 100,
    description: 'Reached 100 workouts milestone!'
  });
  await saveAchievement(communityId, 'ach-alex-100', {
    userId: 'demo-user-alex',
    displayName: 'Alex Morgan',
    type: 'workout_count',
    value: 100,
    description: 'Reached 100 workouts milestone!'
  });
  await saveAchievement(communityId, 'ach-maya-bench-pr', {
    userId: 'demo-user-maya',
    displayName: 'Maya Singh',
    type: 'bench_pr',
    value: 65,
    description: 'New Bench Press PR — 65kg × 8'
  });

  console.log("🎉 Seeding complete!");
  console.log(`- Teja username: @${TEJA_USERNAME}`);
  console.log(`- Fictional users seeded: ${DEMO_USERS.length}`);
  console.log(`- Food products seeded: ${SEEDED_FOOD_PRODUCTS.length}`);
  console.log(`- Total workouts seeded: ${totalWorkouts}`);
  console.log(`- Total measurements seeded: ${totalMeasurements}`);
  console.log(`- Total food logs seeded: ${totalFoodLogs}`);
  console.log(`- Total community posts seeded: ${totalCommunityPosts}`);
}

main().catch(err => {
  console.error("FATAL: Seeding failed:", err);
  process.exit(1);
});
