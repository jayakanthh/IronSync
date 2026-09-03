/**
 * Services barrel — the app's whole backend surface in one import.
 * UI can do:  import { logWorkout, getStreakBoard } from '../services';
 * Owner: jaikanth (backend).
 */
export * from './auth/auth';
export * from './users/users';
export * from './users/profile';
export * from './users/privacy';
export * from './workouts/workouts';
export * from './exercises/exercises';
export * from './workouts/plans';
export * from './duo/groups';
export * from './users/friends';
export * from './nutrition/nutrition';
export * from './nutrition/barcode';
export * from './workouts/streaks';
export * from '../utils/formatting/dates';
export * from './community/community';
export * from './users/follow';
export * from './duo/duoSession';
export { auth, db } from '../config/firebase';
export * from './measurements/measurements';
export * from './measurements/energy';
export * from './notifications/notification';
