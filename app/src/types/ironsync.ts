export type ScreenType =
  | 'home'
  | 'live_workout'
  | 'progress_analytics'
  | 'community'
  | 'community_settings'
  | 'community_discovery'
  | 'exercise_library'
  | 'routine_library'
  | 'create_routine'
  | 'profile'
  | 'friends'
  | 'nutrition'
  | 'workout_history'
  | 'strength_pr';

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  email: string;
  currentWeight: number;
  targetWeight: number;
  weightChangeThisWeek: number;
  weightPacingAhead: number;
  goalDays: number;
  goalTargetDate: string;
  goalProgressPercent: number;
  caloriesToday: number;
  activityMinutesToday: number;
}

export type WorkoutMode = 'solo' | 'duo' | 'group';

export interface TrainingBuddy {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'in-workout' | 'offline' | 'active';
  activityTitle: string;
  currentSetDisplay?: string;
  currentKg?: number;
  currentReps?: number;
  currentExercise?: string;
  currentSet?: number;
  totalSets?: number;
  lastKg?: number;
  lastReps?: number;
  gymName?: string;
  gymLocation?: string;
  isMutualFriend?: boolean;
  streakDays?: number;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  username: string;
  status: 'training_now' | 'online' | 'offline';
  currentActivity?: string;
  currentExercise?: string;
  gymLocation?: string;
  mutualFriendsCount: number;
  communityName?: string;
  streakDays: number;
  isFriend: boolean;
  requestStatus?: 'none' | 'sent' | 'received' | 'accepted';
}

export interface FriendRequest {
  id: string;
  sender: Friend;
  sentTimeAgo: string;
  mutualFriends: string[];
}

export type MuscleGroup =
  | 'All'
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Legs'
  | 'Core'
  | 'Glutes'
  | 'Calves'
  | 'Neck';

export type EquipmentType =
  | 'All'
  | 'Barbell'
  | 'Dumbbell'
  | 'Cable'
  | 'Machine'
  | 'Bodyweight'
  | 'Smith Machine';

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  subMuscle: string;
  equipment: EquipmentType;
  image: string;
  diagramUrl?: string;
  defaultSets: number;
  defaultReps: string;
  description?: string;
  tips?: string[];
}

export interface RoutineExercise {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  sets: number;
  reps: string;
  notes?: string;
  isSupersetWithNext?: boolean;
}

export interface Routine {
  id: string;
  name: string;
  creator: string;
  creatorAvatar?: string;
  daysPerWeek: number;
  saves: number;
  isSaved?: boolean;
  isActive?: boolean; // this is the user's current default plan (drives Home's "Today's Plan")
  isPublic: boolean;
  category: 'Strength' | 'Hypertrophy' | 'Beginner' | 'Advanced' | 'Home';
  description?: string;
  exercises: RoutineExercise[];
}

export interface WorkoutSetRecord {
  setNumber: number;
  targetReps: string;
  kg: number;
  reps: number;
  rpe?: number;
  rir?: number;
  completed: boolean;
  notes?: string;
  isWarmup?: boolean;
  isDropSet?: boolean;
  partnerKg?: number;
  partnerReps?: number;
  partnerCompleted?: boolean;
}

export interface GroupLifter {
  id: string;
  name: string;
  avatar: string;
  currentSet: number;
  totalSets: number;
  lastKg: number;
  lastReps: number;
  completed: boolean;
  isResting: boolean;
}

export interface ActiveWorkoutState {
  id: string;
  routineName: string;
  category: string;
  mode?: WorkoutMode;
  startTime: number;
  isLiveDuo: boolean;
  partner?: TrainingBuddy;
  groupSquad?: GroupLifter[];
  currentExerciseIndex: number;
  exercises: {
    exercise: Exercise;
    isSupersetWithNext?: boolean;
    notes?: string;
    sets: WorkoutSetRecord[];
  }[];
  isResting: boolean;
  restTimeRemaining: number;
  restTotalDuration: number;
  isPartnerTurn: boolean;
}

export interface WorkoutHistoryItem {
  id: string;
  date: string;
  displayDate: string;
  title: string;
  mode: WorkoutMode;
  durationMinutes: number;
  totalSets: number;
  volumeKg: number;
  exercisesCount: number;
  partnerNames?: string[];
  prCount?: number;
  notes?: string;
  exercises: {
    exerciseId?: string;
    name: string;
    muscleGroup: string;
    sets: {
      setNumber: number;
      kg: number;
      reps: number;
      rpe?: number;
      completed?: boolean;
      isPR?: boolean;
    }[];
  }[];
}

// Body Measurements System
export type MeasurementPart =
  | 'hips'
  | 'waist'
  | 'biceps'
  | 'triceps'
  | 'neck'
  | 'glutes'
  | 'chest'
  | 'thighs'
  | 'calves'
  | 'shoulders';

export interface MeasurementLog {
  id: string;
  part: MeasurementPart;
  value: number; // in cm
  unit: 'cm' | 'in';
  date: string;
  displayDate: string;
  notes?: string;
}

export interface MeasurementSummary {
  part: MeasurementPart;
  label: string;
  currentValue: number;
  previousValue: number;
  startValue: number;
  changeCm: number;
  unit: string;
  iconName: string;
  history: MeasurementLog[];
}

// Nutrition & Calorie Tracking System
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  portion: string;
  timeAdded?: string;
  isQuickAdd?: boolean;
}

export interface DailyNutrition {
  date: string;
  caloriesTarget: number;
  caloriesConsumed: number;
  proteinTarget: number;
  proteinConsumed: number;
  carbsTarget: number;
  carbsConsumed: number;
  fatTarget: number;
  fatConsumed: number;
  waterMl: number;
  waterTargetMl: number;
  meals: Record<MealType, MealItem[]>;
}

// Strength Analytics & PRs
export interface ExercisePR {
  exerciseId: string;
  exerciseName: string;
  category: string;
  estimated1RM: number;
  weightPR: { weight: number; reps: number; date: string };
  repPR: { weight: number; reps: number; date: string };
  volumePR: { volume: number; date: string };
  history: {
    date: string;
    displayDate: string;
    weight: number;
    reps: number;
    estimated1RM: number;
    isPR?: boolean;
  }[];
}

// Achievements
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'PR' | 'Consistency' | 'Milestone' | 'Community' | 'Nutrition';
  unlocked: boolean;
  unlockedAt?: string;
  progress: number;
  maxProgress: number;
  unit?: string;
  rewardBadge: string;
}

// Community Discovery & Categories
export type CommunityCategory =
  | 'Gym'
  | 'Apartment/Building'
  | 'College'
  | 'Office'
  | 'Friends'
  | 'Custom';

export interface CommunityItem {
  id: string;
  name: string;
  category: CommunityCategory;
  avatar: string;
  coverImage: string;
  location: string;
  membersCount: number;
  activeNowCount: number;
  description: string;
  isPrivate: boolean;
  isJoined: boolean;
  hasRequested?: boolean;
  inviteCode?: string;
  tags: string[];
}

// Community Challenges & Leaderboards
export interface CommunityChallenge {
  id: string;
  communityId: string;
  title: string;
  description: string;
  type: 'days' | 'steps' | 'workouts' | 'pr_bench';
  targetValue: number;
  userCurrentValue: number;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isJoined: boolean;
  participantsCount: number;
  friendParticipants: {
    name: string;
    avatar: string;
    progressPercent: number;
  }[];
}

export type LeaderboardCategory =
  | 'consistent'
  | 'workouts'
  | 'prs'
  | 'improved'
  | 'active';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  value: string;
  metricLabel: string;
  badge: string;
  isUser?: boolean;
  isFriend?: boolean;
}

// Plateau Detection
export interface PlateauDiagnosis {
  isDetected: boolean;
  stableDays: number;
  currentWeightAvg: number;
  avgDailyCalories: number;
  avgDailySteps: number;
  workoutsPerWeek: number;
  severity: 'moderate' | 'warning' | 'normal';
  analysisMessage: string;
  recommendedAction: string;
}

export type PlateauStatus = PlateauDiagnosis;

// Recovery & Readiness
export interface MuscleReadiness {
  muscle: string;
  status: 'prime' | 'optimal' | 'fatigued' | 'sore';
  fatiguePercent: number;
  color: string;
}

export interface ReadinessScore {
  overallScore: number; // 0-100
  status: 'Prime' | 'Ready' | 'Caution' | 'Rest Needed';
  headline: string;
  recommendation: string;
  muscles: MuscleReadiness[];
  sleepHours: number;
  hrvStatus: string;
}

export type RecoveryStatus = ReadinessScore;

// Muscle Volume & Heatmap
export interface MuscleVolumeData {
  muscle: string;
  weeklySets: number;
  targetSets: number;
  percentageDiffVsBalance: number;
  isBalanced: boolean;
  recommendationNote?: string;
}

// Feed Posts & Social
export interface FeedPost {
  id: string;
  author: {
    name: string;
    avatar: string;
    isDuo?: boolean;
    isGroup?: boolean;
    partnerName?: string;
    partnerAvatar?: string;
    squadCount?: number;
  };
  timeAgo: string;
  type: 'pr' | 'workout_complete' | 'general' | 'achievement' | 'challenge' | 'pr_celebration';
  headline?: string;
  subHeadline?: string;
  content?: string;
  achievementBadge?: string;
  volumeStat?: {
    label: string;
    value: string;
    comparison: string;
  };
  workoutStat?: {
    time: string;
    sets: number;
    exercises?: number;
    mode?: WorkoutMode;
  };
  likes: number;
  commentsCount: number;
  hasLiked: boolean;
  hasCelebrated: boolean;
  comments?: {
    id: string;
    author: string;
    avatar: string;
    text: string;
    timeAgo: string;
  }[];
}

export interface PendingMemberRequest {
  id: string;
  name: string;
  avatar: string;
  requestedTimeAgo: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface CommunityData {
  id: string;
  name: string;
  avatar: string;
  description: string;
  membersCount: number;
  activeCount: number;
  isPrivate: boolean;
  restrictPosting: boolean;
  category: CommunityCategory;
  location?: string;
  pendingRequests: PendingMemberRequest[];
}

export interface WeightHistoryEntry {
  id: string;
  date: string;
  displayDate: string;
  weight: number;
  targetWeight: number;
  notes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timeAgo: string;
  read?: boolean;
  isRead?: boolean;
  type: 'friend_request' | 'duo_invite' | 'group_invite' | 'pr' | 'cheer' | 'challenge' | 'training_live' | 'invite' | 'system';
  actionable?: boolean;
  partner?: TrainingBuddy;
  inviterName?: string;
  inviterAvatar?: string;
  routineName?: string;
}

export type AppNotification = NotificationItem;

/** A history row with the name of whoever logged it — used by Home's feed. */
export interface WorkoutHistoryItemWithCreator extends WorkoutHistoryItem {
  creatorName?: string;
}
