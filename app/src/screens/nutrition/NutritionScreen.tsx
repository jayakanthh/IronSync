import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import {
  Utensils, Plus, Sparkles, Flame, Droplets, Trash2,
  Bot, ChevronDown, ChevronUp, Check, Search, ArrowLeft, Heart, Edit2, Info, TrendingUp,
  ChevronLeft, ChevronRight, Bookmark, Copy, Minus, CalendarDays
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme/colors';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Typography } from '../../components/ui/Typography';
import type { FoodLogEntry, Goal, Meal, NutritionTargets, FoodProduct, SavedMeal } from '../../models/index';
import {
  currentUserId, deleteFood, getFoodLog, getNutritionTargets,
  logFood, setNutritionTargets, sumDay, sumMicros, todayISO, addDays, fromISODate,
  seedFoodDatabase, searchFoods, createCustomFood, getCustomFoods,
  getRecentFoods, getFrequentFoods, getFavoriteFoods, toggleFavoriteFood,
  updateCustomFood, deleteCustomFood,
  getWater, setWater, suggestWaterTarget, getFoodLogRange,
  saveMeal, getSavedMeals, deleteSavedMeal, logSavedMeal, copyMealFromDate
} from '../../services/index';
import { useCurrentUser } from '../../context/CurrentUser';

// ─── Types ───────────────────────────────────────────────────────────────────
type ViewMode = 'diary' | 'search' | 'detail' | 'ai_review' | 'setup' | 'progress';

// ─── AI Preset Prompts ────────────────────────────────────────────────────────
const PRESET_AI_PROMPTS = [
  '300g sweet potato, 150g chicken and 2 eggs',
  '1 scoop whey protein with 300ml almond milk & 1 banana',
  '200g salmon fillet with 150g jasmine rice & broccoli',
  '4 whole eggs scramble with 2 slices sourdough toast',
];

// ─── AI Food Parser (simulated local parser) ──────────────────────────────────
function runAIParser(text: string): Omit<FoodLogEntry, 'id'>[] {
  const t = text.toLowerCase();
  const items: Omit<FoodLogEntry, 'id'>[] = [];
  const now = Date.now();

  if (t.includes('sweet potato') || t.includes('chicken') || t.includes('egg')) {
    if (t.includes('sweet potato')) items.push({ name: 'Roasted Sweet Potato (300g)', calories: 258, proteinG: 6, carbsG: 60, fatG: 0.5, meal: 'lunch', date: todayISO(), createdAt: now, quantity: 300, unit: 'g' });
    if (t.includes('chicken')) items.push({ name: 'Grilled Chicken Breast (150g)', calories: 247, proteinG: 46, carbsG: 0, fatG: 5.4, meal: 'lunch', date: todayISO(), createdAt: now, quantity: 150, unit: 'g' });
    if (t.includes('egg')) items.push({ name: 'Large Whole Eggs (2 eggs)', calories: 144, proteinG: 12, carbsG: 1, fatG: 10, meal: 'lunch', date: todayISO(), createdAt: now, quantity: 2, unit: 'pieces' });
  } else if (t.includes('whey') || t.includes('protein')) {
    items.push({ name: 'Whey Protein Isolate', calories: 120, proteinG: 25, carbsG: 2, fatG: 1, meal: 'snacks', date: todayISO(), createdAt: now, quantity: 1, unit: 'serving' });
    if (t.includes('banana')) items.push({ name: 'Banana (medium)', calories: 89, proteinG: 1, carbsG: 23, fatG: 0.3, meal: 'snacks', date: todayISO(), createdAt: now, quantity: 1, unit: 'piece' });
  } else if (t.includes('salmon') || t.includes('rice')) {
    items.push({ name: 'Salmon Fillet (200g)', calories: 412, proteinG: 45, carbsG: 0, fatG: 24, meal: 'dinner', date: todayISO(), createdAt: now, quantity: 200, unit: 'g' });
    if (t.includes('rice')) items.push({ name: 'Jasmine Rice (150g)', calories: 195, proteinG: 4, carbsG: 43, fatG: 0.5, meal: 'dinner', date: todayISO(), createdAt: now, quantity: 150, unit: 'g' });
  } else if (t.includes('scramble') || t.includes('toast') || t.includes('sourdough')) {
    items.push({ name: 'Scrambled Eggs (4 whole)', calories: 288, proteinG: 24, carbsG: 2, fatG: 20, meal: 'breakfast', date: todayISO(), createdAt: now, quantity: 4, unit: 'pieces' });
    if (t.includes('toast') || t.includes('sourdough')) items.push({ name: 'Sourdough Toast (2 slices)', calories: 198, proteinG: 7, carbsG: 38, fatG: 1.5, meal: 'breakfast', date: todayISO(), createdAt: now, quantity: 2, unit: 'pieces' });
  } else if (t.trim()) {
    items.push({ name: `${text.trim()} (AI estimate)`, calories: Math.max(150, Math.min(600, text.length * 6)), proteinG: 20, carbsG: 30, fatG: 10, meal: 'lunch', date: todayISO(), createdAt: now, quantity: 1, unit: 'serving' });
  }

  return items;
}

function suggest(goal: Goal | undefined, weightKg = 75): NutritionTargets {
  const perKg = goal === 'cut' ? 28 : goal === 'bulk' ? 38 : 33;
  const dailyCalories = Math.round(weightKg * perKg);
  const proteinG = Math.round(weightKg * 2);
  const fatG = Math.round(weightKg * 1);
  const carbsG = Math.max(0, Math.round((dailyCalories - proteinG * 4 - fatG * 9) / 4));
  const fiberG = Math.round((dailyCalories / 1000) * 14); // ~14g fibre per 1000 kcal
  return { dailyCalories, proteinG, carbsG, fatG, fiberG };
}

const MEALS: { key: Meal; label: string; icon: string }[] = [
  { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { key: 'lunch', label: 'Lunch', icon: '☀️' },
  { key: 'dinner', label: 'Dinner', icon: '🌙' },
  { key: 'snacks', label: 'Snacks', icon: '⚡' },
];

function CircularProgress({ percent, color, size = 96, strokeWidth = 9 }: {
  percent: number; color: string; size?: number; strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(percent, 100) / 100);
  const cx = size / 2, cy = size / 2;

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={cx} cy={cy} r={r} stroke={colors.surfaceAlt} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={color} strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Color per macro — shared by the rings and their legend.
const MACRO_COLORS = {
  calories: '#f97316', // orange
  protein: '#06b6d4', // cyan
  carbs: '#f59e0b', // amber
  fat: '#f472b6', // pink
  fiber: '#22c55e', // green
};

/** Apple-Fitness-style concentric rings: one per macro, each color-coded. */
function MacroRings({ totals, targets, size = 172 }: {
  totals: NutritionTargets; targets: NutritionTargets; size?: number;
}) {
  const rings = [
    { consumed: totals.dailyCalories, target: targets.dailyCalories, color: MACRO_COLORS.calories },
    { consumed: totals.proteinG, target: targets.proteinG, color: MACRO_COLORS.protein },
    { consumed: totals.carbsG, target: targets.carbsG, color: MACRO_COLORS.carbs },
    { consumed: totals.fatG, target: targets.fatG, color: MACRO_COLORS.fat },
    { consumed: totals.fiberG, target: targets.fiberG, color: MACRO_COLORS.fiber },
  ];
  const strokeWidth = 12;
  const gap = 3;
  const c = size / 2;

  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${c}, ${c}`}>
        {rings.map((r, i) => {
          const radius = c - strokeWidth / 2 - i * (strokeWidth + gap);
          const circ = 2 * Math.PI * radius;
          const pct = r.target > 0 ? Math.min(1, r.consumed / r.target) : 0;
          return (
            <React.Fragment key={i}>
              <Circle cx={c} cy={c} r={radius} stroke={r.color + '26'} strokeWidth={strokeWidth} fill="none" />
              <Circle
                cx={c} cy={c} r={radius}
                stroke={r.color} strokeWidth={strokeWidth} fill="none"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
              />
            </React.Fragment>
          );
        })}
      </G>
    </Svg>
  );
}

/** Compact macro row shown beside the rings: color dot, label, consumed/target. */
function MiniMacro({ color, label, consumed, target }: {
  color: string; label: string; consumed: number; target: number;
}) {
  return (
    <View style={styles.miniRow}>
      <View style={[styles.miniDot, { backgroundColor: color }]} />
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniVal}>{Math.round(consumed)} / {target} g</Text>
    </View>
  );
}

/** One number in the reports grid: big value, unit, and what it measures. */
function StatCell({ label, value, unit, color }: {
  label: string; value: string; unit: string; color: string;
}) {
  return (
    <View style={styles.statCell}>
      <View style={styles.statValueRow}>
        <Typography variant="h2" color={color}>{value}</Typography>
        <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{unit}</Typography>
      </View>
      <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{label}</Typography>
    </View>
  );
}

/** First and last day of the month containing `iso`, as day strings. */
function monthBounds(iso: string): { start: string; end: string } {
  const d = fromISODate(iso);
  const first = new Date(d.getFullYear(), d.getMonth(), 1, 12);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { start: fmt(first), end: fmt(last) };
}

/** Same day-of-month in a month `delta` away (clamped by the JS Date rollover). */
function shiftMonth(iso: string, delta: number): string {
  const d = fromISODate(iso);
  const shifted = new Date(d.getFullYear(), d.getMonth() + delta, 1, 12);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * The cells of a month grid: leading blanks so the 1st lands under its weekday
 * (Sunday-first), then every day of the month.
 */
function monthGrid(iso: string): (string | null)[] {
  const { start, end } = monthBounds(iso);
  const lead = fromISODate(start).getDay();
  const daysInMonth = fromISODate(end).getDate();
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(start, i)),
  ];
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Friendly name for a day: Today / Yesterday / "Mon 14 Sep". */
function dayLabel(iso: string): string {
  if (iso === todayISO()) return 'Today';
  if (iso === addDays(todayISO(), -1)) return 'Yesterday';
  return fromISODate(iso).toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function NutritionScreen() {
  const { profile } = useCurrentUser();
  const insets = useSafeAreaInsets();

  const [viewMode, setViewMode] = useState<ViewMode>('diary');
  // Which day the diary is showing. Everything logs against this, not "now".
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  // Month-grid picker: which month it's showing, and which of its days have food logged.
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<string>(todayISO());
  const [loggedDays, setLoggedDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [dayEntries, setDayEntries] = useState<FoodLogEntry[]>([]);

  // Goals setup (first-open questionnaire) + progress
  const [setupVals, setSetupVals] = useState({ cals: '', protein: '', carbs: '', fat: '', fiber: '' });
  const [progressRange, setProgressRange] = useState<'week' | 'month'>('week');
  const [savingTargets, setSavingTargets] = useState(false);
  const [progressDays, setProgressDays] = useState<
    { date: string; calories: number; proteinG: number; carbsG: number; fatG: number; fiberG: number }[]
  >([]);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // UI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<Meal>('lunch');
  const [expandedMeal, setExpandedMeal] = useState<Meal | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTab, setSearchTab] = useState<'search' | 'recent' | 'frequent' | 'favorites' | 'my_foods' | 'meals'>('search');
  const [recentFoods, setRecentFoods] = useState<FoodProduct[]>([]);
  const [frequentFoods, setFrequentFoods] = useState<FoodProduct[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<FoodProduct[]>([]);
  const [customFoods, setCustomFoods] = useState<FoodProduct[]>([]);

  // Detail / Logging Form State
  const [selectedFood, setSelectedFood] = useState<FoodProduct | null>(null);
  const [logQty, setLogQty] = useState('100');
  const [logUnit, setLogUnit] = useState('g');
  const [isFavorite, setIsFavorite] = useState(false);
  
  // Custom Food Form State
  const [showCustomModal, setShowCustomModal] = useState(false);
  // Set when the custom-food form is editing an existing one rather than creating.
  const [editingCustomFood, setEditingCustomFood] = useState<FoodProduct | null>(null);
  const [customName, setCustomName] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customSize, setCustomSize] = useState('100');
  const [customUnit, setCustomUnit] = useState('g');
  const [customCal, setCustomCal] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');

  // Editing logged entry state
  const [editingEntry, setEditingEntry] = useState<FoodLogEntry | null>(null);

  // AI Review State
  const [aiReviewedItems, setAiReviewedItems] = useState<Omit<FoodLogEntry, 'id'>[]>([]);

  // Water local state
  const [waterMl, setWaterMl] = useState(0);
  const waterTarget = suggestWaterTarget((profile as any)?.weightKg);

  // ── Saved meals ("my usual breakfast") ────────────────────────────────────
  const [savedMeals, setSavedMeals] = useState<SavedMeal[]>([]);
  const [saveMealFor, setSaveMealFor] = useState<Meal | null>(null);
  const [saveMealName, setSaveMealName] = useState('');

  // Initial seed and load
  useEffect(() => {
    async function initDb() {
      try {
        await seedFoodDatabase();
      } catch (err) {
        console.error("Error seeding food database:", err);
      }
    }
    initDb();
  }, []);

  const loadData = useCallback(async () => {
    const uid = currentUserId();
    if (!uid) { setLoading(false); return; }

    const [t, entries, water, meals] = await Promise.all([
      getNutritionTargets(uid),
      getFoodLog(uid, selectedDate),
      getWater(uid, selectedDate),
      getSavedMeals(uid),
    ]);
    setWaterMl(water);
    setSavedMeals(meals);

    const goal = (profile as any)?.goal as Goal | undefined;
    const weightKg = (profile as any)?.weightKg;
    const suggested = suggest(goal, weightKg ?? 75);
    // Back-fill fibre target for goals saved before fibre existed.
    const resolved = t ? { ...t, fiberG: t.fiberG || suggested.fiberG } : suggested;
    setTargets(resolved);
    setDayEntries(entries);

    // First open (no saved goals) → prefill the setup form with suggestions
    // and ask the user to confirm their calorie/macro targets.
    if (!t) {
      setSetupVals({
        cals: String(suggested.dailyCalories),
        protein: String(suggested.proteinG),
        carbs: String(suggested.carbsG),
        fat: String(suggested.fatG),
        fiber: String(suggested.fiberG),
      });
      setViewMode('setup');
    }
    setLoading(false);
  }, [profile, selectedDate]);

  const handleSaveTargets = async () => {
    const uid = currentUserId();
    if (!uid) return;
    const next: NutritionTargets = {
      dailyCalories: Math.max(0, parseInt(setupVals.cals) || 0),
      proteinG: Math.max(0, parseInt(setupVals.protein) || 0),
      carbsG: Math.max(0, parseInt(setupVals.carbs) || 0),
      fatG: Math.max(0, parseInt(setupVals.fat) || 0),
      fiberG: Math.max(0, parseInt(setupVals.fiber) || 0),
    };
    setSavingTargets(true);
    try {
      await setNutritionTargets(uid, next);
      setTargets(next);
      setViewMode('diary');
    } catch {
      Alert.alert('Error', 'Could not save your goals. Please try again.');
    } finally {
      setSavingTargets(false);
    }
  };

  const openEditTargets = () => {
    if (targets) {
      setSetupVals({
        cals: String(targets.dailyCalories),
        protein: String(targets.proteinG),
        carbs: String(targets.carbsG),
        fat: String(targets.fatG),
        fiber: String(targets.fiberG),
      });
    }
    setViewMode('setup');
  };

  const loadProgress = async (range: 'week' | 'month' = progressRange) => {
    const uid = currentUserId();
    if (!uid) return;
    setProgressRange(range);
    setLoadingProgress(true);
    setViewMode('progress');
    try {
      const n = range === 'week' ? 7 : 30;
      const end = todayISO();
      const start = addDays(end, -(n - 1));
      // One range query for the whole window, then bucket by day.
      const entries = await getFoodLogRange(uid, start, end);
      const byDay = new Map<string, FoodLogEntry[]>();
      entries.forEach((e) => byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]));

      const days = Array.from({ length: n }, (_, idx) => {
        const iso = addDays(start, idx);
        const totals = sumDay(byDay.get(iso) ?? []);
        return {
          date: iso,
          calories: totals.dailyCalories,
          proteinG: totals.proteinG,
          carbsG: totals.carbsG,
          fatG: totals.fatG,
          fiberG: totals.fiberG,
        };
      });
      setProgressDays(days);
    } catch {
      setProgressDays([]);
    } finally {
      setLoadingProgress(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Load search lists
  const loadSearchTabsData = async () => {
    const uid = currentUserId();
    if (!uid) return;
    try {
      const [recent, freq, favs, custom] = await Promise.all([
        getRecentFoods(uid),
        getFrequentFoods(uid),
        getFavoriteFoods(uid),
        getCustomFoods(uid)
      ]);
      setRecentFoods(recent);
      setFrequentFoods(freq);
      setFavoriteFoods(favs);
      setCustomFoods(custom);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (viewMode === 'search') {
      loadSearchTabsData();
    }
  }, [viewMode]);

  // Debounced search logic
  useEffect(() => {
    const uid = currentUserId();
    if (!uid || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const delay = setTimeout(async () => {
      try {
        const results = await searchFoods(searchQuery, uid);
        setSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  // Computed totals
  const totals = useMemo(() => sumDay(dayEntries), [dayEntries]);
  const micros = useMemo(() => sumMicros(dayEntries), [dayEntries]);
  const t = targets ?? suggest(undefined);

  const caloriePercent = Math.min(100, Math.round((totals.dailyCalories / t.dailyCalories) * 100)) || 0;
  const proteinPercent = Math.min(100, Math.round((totals.proteinG / t.proteinG) * 100)) || 0;
  const carbsPercent = Math.min(100, Math.round((totals.carbsG / t.carbsG) * 100)) || 0;
  const fatPercent = Math.min(100, Math.round((totals.fatG / t.fatG) * 100)) || 0;
  const waterPercent = Math.min(100, Math.round((waterMl / waterTarget) * 100));

  /** Water writes straight through — optimistic locally, saved per day. */
  const adjustWater = async (deltaMl: number) => {
    const uid = currentUserId();
    if (!uid) return;
    const next = Math.max(0, waterMl + deltaMl);
    setWaterMl(next);
    try {
      await setWater(uid, selectedDate, next);
    } catch {
      setWaterMl(waterMl); // put it back if the write failed
    }
  };
  const calorieRemaining = Math.max(0, t.dailyCalories - totals.dailyCalories);

  // ── AI Parser Review Flow ──────────────────────────────────────────────────
  const handleAILog = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiProcessing(true);
    await new Promise((res) => setTimeout(res, 800)); // Sim parse delay
    const parsed = runAIParser(aiPrompt);
    if (parsed.length === 0) {
      Alert.alert('Could not parse', 'Try describing the food specifically, e.g. "200g chicken".');
      setIsAiProcessing(false);
      return;
    }
    setAiReviewedItems(parsed.map(item => ({ ...item, meal: selectedMeal })));
    setViewMode('ai_review');
    setIsAiProcessing(false);
  };

  const handleSaveAIReview = async () => {
    const uid = currentUserId();
    if (!uid) return;
    setLoading(true);
    await Promise.all(
      aiReviewedItems.map(item => logFood(uid, { ...item, date: selectedDate }))
    );
    setAiPrompt('');
    setViewMode('diary');
    await loadData();
  };

  // ── Calendar ──────────────────────────────────────────────────────────────
  /**
   * Load which days of the visible month have any food logged, so the grid can
   * dot them. One range query for the whole month.
   */
  const loadMonthDots = useCallback(async (monthAnchor: string) => {
    const uid = currentUserId();
    if (!uid) return;
    const { start, end } = monthBounds(monthAnchor);
    try {
      const entries = await getFoodLogRange(uid, start, end);
      setLoggedDays(new Set(entries.map((e) => e.date)));
    } catch {
      setLoggedDays(new Set());
    }
  }, []);

  const openCalendar = () => {
    setCalendarMonth(selectedDate);
    setShowCalendar(true);
    loadMonthDots(selectedDate);
  };

  const goToMonth = (delta: number) => {
    const next = shiftMonth(calendarMonth, delta);
    setCalendarMonth(next);
    loadMonthDots(next);
  };

  const pickDay = (iso: string) => {
    if (iso > todayISO()) return; // can't log the future
    setSelectedDate(iso);
    setShowCalendar(false);
  };

  // ── Saved meals ───────────────────────────────────────────────────────────
  /** Snapshot everything in one meal slot so it can be re-logged in a tap. */
  const handleSaveMeal = async () => {
    const uid = currentUserId();
    if (!uid || !saveMealFor) return;
    const name = saveMealName.trim();
    if (!name) return Alert.alert('Name it', 'Give this meal a name so you can find it later.');

    const items = dayEntries
      .filter((e) => e.meal === saveMealFor)
      .map(({ id, date, meal, createdAt, ...item }) => item);
    if (items.length === 0) return;

    try {
      await saveMeal(uid, name, items);
      setSaveMealFor(null);
      setSaveMealName('');
      setSavedMeals(await getSavedMeals(uid));
      Alert.alert('Saved', `"${name}" is in your Meals tab — log it any time in one tap.`);
    } catch {
      Alert.alert('Could not save', 'Something went wrong saving that meal. Try again.');
    }
  };

  const handleLogSavedMeal = async (meal: SavedMeal) => {
    const uid = currentUserId();
    if (!uid) return;
    setLoading(true);
    try {
      await logSavedMeal(uid, meal, selectedDate, selectedMeal);
      setViewMode('diary');
      await loadData();
    } catch {
      setLoading(false);
      Alert.alert('Could not log', 'Something went wrong logging that meal. Try again.');
    }
  };

  const handleDeleteSavedMeal = (meal: SavedMeal) => {
    Alert.alert('Delete meal', `Remove "${meal.name}" from your saved meals?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const uid = currentUserId();
          if (!uid) return;
          await deleteSavedMeal(uid, meal.id);
          setSavedMeals(await getSavedMeals(uid));
        },
      },
    ]);
  };

  /** Re-log the same slot from the previous day. */
  const handleCopyYesterday = async (slot: Meal) => {
    const uid = currentUserId();
    if (!uid) return;
    const from = addDays(selectedDate, -1);
    setLoading(true);
    try {
      const copied = await copyMealFromDate(uid, from, selectedDate, slot);
      if (copied === 0) {
        setLoading(false);
        Alert.alert('Nothing to copy', `You didn't log any ${slot} on ${dayLabel(from).toLowerCase()}.`);
        return;
      }
      await loadData();
    } catch {
      setLoading(false);
      Alert.alert('Could not copy', 'Something went wrong copying that meal. Try again.');
    }
  };

  // ── Detail & Scaling Logic ────────────────────────────────────────────────
  const scaledMacros = useMemo(() => {
    if (!selectedFood) return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
    const qty = parseFloat(logQty) || 0;
    const factor = qty / (selectedFood.servingSize || 1);
    return {
      calories: Math.round(selectedFood.calories * factor),
      protein: parseFloat((selectedFood.protein * factor).toFixed(1)),
      carbs: parseFloat((selectedFood.carbs * factor).toFixed(1)),
      fat: parseFloat((selectedFood.fat * factor).toFixed(1)),
      fiber: selectedFood.fiber ? parseFloat((selectedFood.fiber * factor).toFixed(1)) : 0,
      sugar: selectedFood.sugar ? parseFloat((selectedFood.sugar * factor).toFixed(1)) : 0,
      sodium: selectedFood.sodium ? parseFloat((selectedFood.sodium * factor).toFixed(1)) : 0,
    };
  }, [selectedFood, logQty]);

  const handleAddFoodLog = async () => {
    const uid = currentUserId();
    if (!uid || !selectedFood) return;
    setLoading(true);

    const isEditMode = !!editingEntry;
    if (isEditMode && editingEntry) {
      await deleteFood(uid, editingEntry.id);
    }

    await logFood(uid, {
      name: selectedFood.name,
      date: selectedDate,
      meal: selectedMeal,
      calories: scaledMacros.calories,
      proteinG: scaledMacros.protein,
      carbsG: scaledMacros.carbs,
      fatG: scaledMacros.fat,
      
      // Historical Snapshot Protection
      foodId: selectedFood.id,
      brand: selectedFood.brand,
      quantity: parseFloat(logQty) || 0,
      unit: logUnit,
      fiberG: scaledMacros.fiber,
      sugarG: scaledMacros.sugar,
      sodiumMg: scaledMacros.sodium,
    });

    setEditingEntry(null);
    setViewMode('diary');
    await loadData();
  };

  const handleEditLoggedEntry = (entry: FoodLogEntry) => {
    setEditingEntry(entry);
    // Find or simulate a FoodProduct from the snapshot
    const foodProd: FoodProduct = {
      id: entry.foodId || 'custom_direct',
      name: entry.name,
      normalizedName: entry.name.toLowerCase(),
      brand: entry.brand,
      servingSize: 100, // base unit scale
      servingUnit: entry.unit || 'g',
      calories: entry.foodId ? (entry.calories / ((entry.quantity || 100)/100)) : entry.calories, // backscale
      protein: entry.foodId ? (entry.proteinG / ((entry.quantity || 100)/100)) : entry.proteinG,
      carbs: entry.foodId ? (entry.carbsG / ((entry.quantity || 100)/100)) : entry.carbsG,
      fat: entry.foodId ? (entry.fatG / ((entry.quantity || 100)/100)) : entry.fatG,
      verified: false,
      source: 'snapshot',
      createdAt: entry.createdAt,
      updatedAt: Date.now()
    };
    setSelectedFood(foodProd);
    setLogQty((entry.quantity || 100).toString());
    setLogUnit(entry.unit || 'g');
    setSelectedMeal(entry.meal || 'lunch');
    setViewMode('detail');
  };

  const handleFavoriteToggle = async () => {
    const uid = currentUserId();
    if (!uid || !selectedFood) return;
    const nextState = !isFavorite;
    setIsFavorite(nextState);
    await toggleFavoriteFood(uid, selectedFood, nextState);
    await loadSearchTabsData();
  };

  // ── Custom Food Handler ───────────────────────────────────────────────────
  const resetCustomForm = () => {
    setCustomName(''); setCustomBrand(''); setCustomSize('100'); setCustomUnit('g');
    setCustomCal(''); setCustomProtein(''); setCustomCarbs(''); setCustomFat('');
    setEditingCustomFood(null);
  };

  /** Open the form on an existing food so it can be corrected. */
  const openEditCustomFood = (food: FoodProduct) => {
    setEditingCustomFood(food);
    setCustomName(food.name);
    setCustomBrand(food.brand && food.brand !== 'Custom Brand' ? food.brand : '');
    setCustomSize(String(food.servingSize));
    setCustomUnit(food.servingUnit);
    setCustomCal(String(food.calories));
    setCustomProtein(String(food.protein));
    setCustomCarbs(String(food.carbs));
    setCustomFat(String(food.fat));
    setShowCustomModal(true);
  };

  const handleSaveCustomFood = async () => {
    const uid = currentUserId();
    if (!uid) return;
    if (!customName.trim()) return Alert.alert('Name required', 'Enter a product name.');

    const data = {
      name: customName,
      normalizedName: customName.trim().toLowerCase(),
      brand: customBrand || 'Custom Brand',
      servingSize: parseFloat(customSize) || 100,
      servingUnit: customUnit,
      calories: parseFloat(customCal) || 0,
      protein: parseFloat(customProtein) || 0,
      carbs: parseFloat(customCarbs) || 0,
      fat: parseFloat(customFat) || 0,
    };

    setLoading(true);
    // Editing only changes the food itself — anything already logged from it
    // keeps the numbers it was logged with.
    if (editingCustomFood) await updateCustomFood(uid, editingCustomFood.id, data);
    else await createCustomFood(uid, data);

    resetCustomForm();
    setShowCustomModal(false);
    await loadSearchTabsData();
    setSearchTab('my_foods');
    setLoading(false);
  };

  const handleDeleteCustomFood = (food: FoodProduct) => {
    Alert.alert('Delete food', `Remove "${food.name}" from My Foods?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const uid = currentUserId();
          if (!uid) return;
          await deleteCustomFood(uid, food.id);
          resetCustomForm();
          setShowCustomModal(false);
          await loadSearchTabsData();
        },
      },
    ]);
  };

  // ── Delete Handler ──────────────────────────────────────────────────────────
  const handleDelete = async (entryId: string) => {
    const uid = currentUserId();
    if (!uid) return;
    await deleteFood(uid, entryId);
    await loadData();
  };

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 1. DIARY VIEW
  // ──────────────────────────────────────────────────────────────────────────
  // ── Goals setup (first open / edit targets) ──────────────────────────────
  if (viewMode === 'setup') {
    const fields: { key: keyof typeof setupVals; label: string; unit: string }[] = [
      { key: 'cals', label: 'Daily Calories', unit: 'kcal' },
      { key: 'protein', label: 'Protein', unit: 'g' },
      { key: 'carbs', label: 'Carbs', unit: 'g' },
      { key: 'fat', label: 'Fat', unit: 'g' },
      { key: 'fiber', label: 'Fibre', unit: 'g' },
    ];
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Typography variant="h1" style={{ marginTop: 8 }}>Your daily goals</Typography>
          <Typography variant="body" color={colors.textMuted} style={{ marginBottom: 8 }}>
            Set your calorie and macro targets — we'll track your intake against these every day. We've suggested values from your profile; adjust as you like.
          </Typography>

          {fields.map((f) => (
            <View key={f.key} style={styles.setupRow}>
              <Text style={styles.setupLabel}>{f.label}</Text>
              <View style={styles.setupInputWrap}>
                <TextInput
                  style={styles.setupInput}
                  keyboardType="number-pad"
                  value={setupVals[f.key]}
                  onChangeText={(v) => setSetupVals((s) => ({ ...s, [f.key]: v.replace(/[^0-9]/g, '') }))}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                />
                <Text style={styles.setupUnit}>{f.unit}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.setupSaveBtn} onPress={handleSaveTargets} disabled={savingTargets} activeOpacity={0.85}>
            {savingTargets ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <Text style={styles.setupSaveText}>Save & Start Tracking</Text>
            )}
          </TouchableOpacity>
          {targets && (
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={() => setViewMode('diary')}>
              <Text style={{ color: colors.textMuted, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Progress (week / month calorie history) ──────────────────────────────
  if (viewMode === 'progress') {
    const goalCals = targets?.dailyCalories || 0;
    const maxCals = Math.max(goalCals, ...progressDays.map((d) => d.calories), 1);
    const loggedDays = progressDays.filter((d) => d.calories > 0);
    const mean = (pick: (d: typeof progressDays[number]) => number) =>
      loggedDays.length ? Math.round(loggedDays.reduce((a, d) => a + pick(d), 0) / loggedDays.length) : 0;
    const avg = mean((d) => d.calories);
    // "On target" = within 10% of the calorie goal, the usual tracking tolerance.
    const onTarget = goalCals
      ? loggedDays.filter((d) => Math.abs(d.calories - goalCals) <= goalCals * 0.1).length
      : 0;
    const proteinHit = targets?.proteinG
      ? loggedDays.filter((d) => d.proteinG >= targets.proteinG).length
      : 0;
    const CHART_H = 180;
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={() => setViewMode('diary')} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Typography variant="h2">Progress</Typography>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {/* Range toggle */}
          <View style={styles.rangeToggle}>
            {(['week', 'month'] as const).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.rangeBtn, progressRange === r && styles.rangeBtnActive]}
                onPress={() => loadProgress(r)}
              >
                <Text style={[styles.rangeBtnText, progressRange === r && styles.rangeBtnTextActive]}>
                  {r === 'week' ? 'Week' : 'Month'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingProgress ? (
            <ActivityIndicator color={colors.warning} style={{ marginTop: 40 }} />
          ) : (
            <>
              <Typography variant="caption" color={colors.textMuted}>
                Daily calories vs your {goalCals} kcal goal · avg {avg} kcal on logged days
              </Typography>

              {/* Vertical bar chart (scrolls horizontally for the month) */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
                <View style={[styles.chart, { height: CHART_H + 28 }]}>
                  {progressDays.map((d) => {
                    const h = Math.max(2, Math.round((d.calories / maxCals) * CHART_H));
                    const over = goalCals > 0 && d.calories > goalCals;
                    const dt = new Date(d.date + 'T00:00:00');
                    const label = progressRange === 'week'
                      ? dt.toLocaleDateString('default', { weekday: 'short' }).slice(0, 2)
                      : String(dt.getDate());
                    return (
                      <View key={d.date} style={styles.chartCol}>
                        <View style={[styles.chartBarWrap, { height: CHART_H }]}>
                          <View
                            style={[
                              styles.chartBar,
                              { height: h, backgroundColor: d.calories === 0 ? colors.surfaceAlt : over ? colors.danger : colors.warning },
                            ]}
                          />
                        </View>
                        <Text style={styles.chartLabel}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Averages across the days you actually logged */}
              <Card style={styles.statsCard}>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                  DAILY AVERAGE · {loggedDays.length} of {progressDays.length} days logged
                </Typography>
                <View style={styles.statsGrid}>
                  <StatCell label="Calories" value={`${avg}`} unit="kcal" color={colors.warning} />
                  <StatCell label="Protein" value={`${mean((d) => d.proteinG)}`} unit="g" color={MACRO_COLORS.protein} />
                  <StatCell label="Carbs" value={`${mean((d) => d.carbsG)}`} unit="g" color={MACRO_COLORS.carbs} />
                  <StatCell label="Fat" value={`${mean((d) => d.fatG)}`} unit="g" color={MACRO_COLORS.fat} />
                  <StatCell label="Fibre" value={`${mean((d) => d.fiberG)}`} unit="g" color={MACRO_COLORS.fiber} />
                </View>
              </Card>

              {/* How often you actually hit the numbers */}
              <Card style={styles.statsCard}>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                  CONSISTENCY
                </Typography>
                <View style={styles.statsGrid}>
                  <StatCell
                    label="Calories on target"
                    value={`${onTarget}`}
                    unit={`/ ${loggedDays.length} days`}
                    color={colors.warning}
                  />
                  <StatCell
                    label="Protein goal hit"
                    value={`${proteinHit}`}
                    unit={`/ ${loggedDays.length} days`}
                    color={MACRO_COLORS.protein}
                  />
                </View>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10, marginTop: 4 }}>
                  On target = within 10% of your {goalCals} kcal goal.
                </Typography>
              </Card>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  if (viewMode === 'diary') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconBox}>
              <Utensils size={18} color={colors.warning} />
            </View>
            <Typography variant="h2">Nutrition Diary</Typography>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerIconBtn} onPress={() => loadProgress()}>
              <TrendingUp size={20} color={colors.warning} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIconBtn} onPress={openEditTargets}>
              <Edit2 size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Day picker — the diary is no longer stuck on today. */}
        <View style={styles.dayStrip}>
          <TouchableOpacity style={styles.dayArrow} onPress={() => setSelectedDate(addDays(selectedDate, -1))}>
            <ChevronLeft size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.dayLabelBtn} onPress={openCalendar}>
            <View style={styles.dayLabelRow}>
              <CalendarDays size={14} color={colors.warning} />
              <Typography variant="bodyBold" style={{ fontSize: 14 }}>{dayLabel(selectedDate)}</Typography>
            </View>
            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
              {selectedDate === todayISO() ? 'Tap for calendar' : fromISODate(selectedDate).toLocaleDateString('default', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dayArrow, selectedDate >= todayISO() && styles.dayArrowDisabled]}
            onPress={() => setSelectedDate(addDays(selectedDate, 1))}
            disabled={selectedDate >= todayISO()}
          >
            <ChevronRight size={18} color={selectedDate >= todayISO() ? colors.textMuted : colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Macro rings (cals/protein/carbs/fat/fibre) + vertical legend */}
          <Card style={styles.macroCard}>
            <View style={styles.ringsRow}>
              <View style={styles.ringsWrap}>
                <MacroRings totals={totals} targets={t} size={150} />
                <View style={styles.ringsCenter}>
                  <Flame size={20} color={colors.warning} />
                </View>
              </View>
              <View style={styles.ringsMeta}>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                  {selectedDate === todayISO() ? "TODAY'S INTAKE" : `INTAKE · ${dayLabel(selectedDate).toUpperCase()}`}
                </Typography>
                <View style={styles.calorieNumberRow}>
                  <Typography variant="h1">{totals.dailyCalories}</Typography>
                  <Typography variant="body" color={colors.textMuted}>/ {t.dailyCalories}</Typography>
                </View>
                <Typography variant="caption" color={colors.warning} style={{ fontSize: 11, marginBottom: 8 }}>
                  {caloriePercent}% of daily budget
                </Typography>

                {/* Small macro details, line by line */}
                <MiniMacro color={MACRO_COLORS.protein} label="Protein" consumed={totals.proteinG} target={t.proteinG} />
                <MiniMacro color={MACRO_COLORS.carbs} label="Carbs" consumed={totals.carbsG} target={t.carbsG} />
                <MiniMacro color={MACRO_COLORS.fat} label="Fat" consumed={totals.fatG} target={t.fatG} />
                <MiniMacro color={MACRO_COLORS.fiber} label="Fibre" consumed={totals.fiberG} target={t.fiberG} />
              </View>
            </View>

            {/* Sugar & sodium — already stored per entry, never shown until now. */}
            <View style={styles.microRow}>
              <View style={styles.microCell}>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>Sugar</Typography>
                <Typography variant="bodyBold" style={{ fontSize: 12 }}>{micros.sugarG.toFixed(1)}g</Typography>
              </View>
              <View style={styles.microDivider} />
              <View style={styles.microCell}>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>Sodium</Typography>
                <Typography variant="bodyBold" style={{ fontSize: 12 }}>{Math.round(micros.sodiumMg)}mg</Typography>
              </View>
              <View style={styles.microDivider} />
              <View style={styles.microCell}>
                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>Fibre</Typography>
                <Typography variant="bodyBold" style={{ fontSize: 12 }}>{totals.fiberG.toFixed(1)}g</Typography>
              </View>
            </View>

            {/* Water Tracker */}
            <View style={styles.waterRow}>
              <View style={styles.waterLeft}>
                <Droplets size={16} color="#3b82f6" />
                <Typography variant="bodyBold" color="#3b82f6" style={{ fontSize: 12 }}>
                  {waterMl} / {waterTarget} ml
                </Typography>
                <View style={styles.waterBarWrap}>
                  <View style={[styles.waterBarFill, { width: `${waterPercent}%` as any }]} />
                </View>
              </View>
              <View style={styles.waterBtns}>
                <TouchableOpacity
                  style={[styles.waterBtn, waterMl === 0 && styles.waterBtnDisabled]}
                  onPress={() => adjustWater(-250)}
                  disabled={waterMl === 0}
                >
                  <Minus size={12} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.waterBtn} onPress={() => adjustWater(250)}>
                  <Typography variant="caption" color="#3b82f6" style={{ fontSize: 10 }}>+250ml</Typography>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Food Diary Meal Sections */}
          {MEALS.map((meal) => {
            const mealItems = dayEntries.filter((e) => e.meal === meal.key);
            const mealCal = mealItems.reduce((acc, i) => acc + i.calories, 0);
            const mealProtein = mealItems.reduce((acc, i) => acc + i.proteinG, 0);
            const isExpanded = expandedMeal === meal.key;

            return (
              <Card key={meal.key} style={styles.mealCard}>
                <TouchableOpacity
                  style={styles.mealHeader}
                  onPress={() => setExpandedMeal(isExpanded ? null : meal.key)}
                >
                  <View style={styles.mealHeaderLeft}>
                    <Text style={styles.mealIcon}>{meal.icon}</Text>
                    <View>
                      <Typography variant="bodyBold">{meal.label}</Typography>
                      <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                        {mealCal} kcal • {mealProtein.toFixed(0)}g protein
                      </Typography>
                    </View>
                  </View>

                  <View style={styles.mealHeaderRight}>
                    <TouchableOpacity style={styles.addToBtnOrange} onPress={() => { setSelectedMeal(meal.key); setViewMode('search'); }}>
                      <Plus size={14} color={colors.warning} />
                    </TouchableOpacity>
                    {isExpanded ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.mealItemList}>
                    {mealItems.length === 0 ? (
                      <View style={styles.mealEmptyRow}>
                        <Typography variant="caption" color={colors.textMuted} style={{ fontStyle: 'italic' }}>
                          No foods logged for {meal.label} yet.
                        </Typography>
                        <TouchableOpacity style={styles.mealActionBtn} onPress={() => handleCopyYesterday(meal.key)}>
                          <Copy size={12} color={colors.warning} />
                          <Typography variant="caption" color={colors.warning} style={{ fontSize: 10 }}>
                            Copy from yesterday
                          </Typography>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      mealItems.map((item) => (
                        <TouchableOpacity key={item.id} style={styles.foodItem} onPress={() => handleEditLoggedEntry(item)}>
                          <View style={styles.foodItemLeft}>
                            <Typography variant="bodyBold" style={{ fontSize: 12 }}>{item.name}</Typography>
                            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                              {item.brand ? `${item.brand} • ` : ''}{item.quantity}{item.unit || 'g'} • {item.proteinG}P • {item.carbsG}C • {item.fatG}F
                            </Typography>
                          </View>
                          <View style={styles.foodItemRight}>
                            <Typography variant="bodyBold" style={{ fontSize: 13, marginRight: 8 }}>{item.calories} kcal</Typography>
                            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                              <Trash2 size={13} color={colors.danger} />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))
                    )}

                    {mealItems.length > 0 && (
                      <TouchableOpacity
                        style={styles.mealActionBtn}
                        onPress={() => { setSaveMealFor(meal.key); setSaveMealName(''); }}
                      >
                        <Bookmark size={12} color={colors.warning} />
                        <Typography variant="caption" color={colors.warning} style={{ fontSize: 10 }}>
                          Save these {mealItems.length} as a meal
                        </Typography>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>

        {/* Month grid — pick any past day; dots mark the days you logged food. */}
        <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowCalendar(false)}>
            <TouchableOpacity style={styles.calendarCard} activeOpacity={1}>
              <View style={styles.calendarHeader}>
                <TouchableOpacity style={styles.dayArrow} onPress={() => goToMonth(-1)}>
                  <ChevronLeft size={18} color={colors.text} />
                </TouchableOpacity>
                <Typography variant="bodyBold">
                  {fromISODate(calendarMonth).toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                </Typography>
                <TouchableOpacity
                  style={[styles.dayArrow, monthBounds(calendarMonth).start >= monthBounds(todayISO()).start && styles.dayArrowDisabled]}
                  onPress={() => goToMonth(1)}
                  disabled={monthBounds(calendarMonth).start >= monthBounds(todayISO()).start}
                >
                  <ChevronRight size={18} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.calendarWeekRow}>
                {WEEKDAY_INITIALS.map((d, i) => (
                  <Text key={i} style={styles.calendarWeekday}>{d}</Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {monthGrid(calendarMonth).map((iso, i) => {
                  if (!iso) return <View key={`blank-${i}`} style={styles.calendarCell} />;
                  const isFuture = iso > todayISO();
                  const isSelected = iso === selectedDate;
                  const isToday = iso === todayISO();
                  return (
                    <TouchableOpacity
                      key={iso}
                      style={styles.calendarCell}
                      onPress={() => pickDay(iso)}
                      disabled={isFuture}
                    >
                      <View style={[
                        styles.calendarDay,
                        isToday && styles.calendarDayToday,
                        isSelected && styles.calendarDaySelected,
                      ]}>
                        <Text style={[
                          styles.calendarDayText,
                          isFuture && styles.calendarDayTextMuted,
                          isSelected && styles.calendarDayTextSelected,
                        ]}>
                          {fromISODate(iso).getDate()}
                        </Text>
                      </View>
                      <View style={[styles.calendarDot, loggedDays.has(iso) && styles.calendarDotOn]} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.calendarTodayBtn} onPress={() => pickDay(todayISO())}>
                <Typography variant="bodyBold" color={colors.warning} style={{ fontSize: 13 }}>Jump to today</Typography>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Name-this-meal sheet (Alert.prompt is iOS-only, so it's a modal). */}
        <Modal visible={!!saveMealFor} transparent animationType="slide" onRequestClose={() => setSaveMealFor(null)}>
          <View style={styles.overlay}>
            <View style={styles.manualModal}>
              <View style={styles.manualModalHeader}>
                <Typography variant="h2">Save this meal</Typography>
                <TouchableOpacity onPress={() => setSaveMealFor(null)}>
                  <Typography variant="body" color={colors.textMuted}>Cancel</Typography>
                </TouchableOpacity>
              </View>
              <Typography variant="caption" color={colors.textMuted} style={{ marginBottom: 12 }}>
                {dayEntries.filter((e) => e.meal === saveMealFor).length} item(s) from{' '}
                {MEALS.find((m) => m.key === saveMealFor)?.label}. You'll be able to log it again in one tap.
              </Typography>
              <TextInput
                style={styles.manualInput}
                placeholder="e.g. My usual breakfast"
                placeholderTextColor={colors.textMuted}
                value={saveMealName}
                onChangeText={setSaveMealName}
                autoFocus
              />
              <Button variant="primary" label="Save meal" onPress={handleSaveMeal} style={{ marginTop: 16 }} />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. SEARCH / PRODUCT FINDER VIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (viewMode === 'search') {
    const listToRender = 
      searchTab === 'search' ? searchResults :
      searchTab === 'recent' ? recentFoods :
      searchTab === 'frequent' ? frequentFoods :
      searchTab === 'favorites' ? favoriteFoods : customFoods;

    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={() => setViewMode('diary')} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.searchBox}>
            <Search size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search foods, products, brands..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>
        </View>

        {/* Tab Row */}
        <View style={styles.searchTabs}>
          {(['search', 'recent', 'frequent', 'favorites', 'my_foods', 'meals'] as const).map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.searchTabItem, searchTab === tab && styles.searchTabActive]}
              onPress={() => setSearchTab(tab)}
            >
              <Typography variant="caption" color={searchTab === tab ? colors.primary : colors.textMuted} style={{ fontSize: 10, textTransform: 'uppercase' }}>
                {tab.replace('_', ' ')}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>

        {searchTab === 'meals' ? (
          <FlatList
            data={savedMeals}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: spacing.md }}
            ListHeaderComponent={
              savedMeals.length > 0 ? (
                <Typography variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
                  Tap a meal to log all of it into {MEALS.find((m) => m.key === selectedMeal)?.label}.
                </Typography>
              ) : null
            }
            ListEmptyComponent={
              <Typography variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: 40 }}>
                No saved meals yet. Log a meal in your diary, then tap "Save these as a meal".
              </Typography>
            }
            renderItem={({ item }) => {
              const cals = item.items.reduce((a, i) => a + i.calories, 0);
              const protein = item.items.reduce((a, i) => a + i.proteinG, 0);
              return (
                <TouchableOpacity
                  style={styles.searchResultItem}
                  onPress={() => handleLogSavedMeal(item)}
                  onLongPress={() => handleDeleteSavedMeal(item)}
                >
                  <View style={{ flex: 1 }}>
                    <Typography variant="bodyBold">{item.name}</Typography>
                    <Typography variant="caption" color={colors.textMuted} numberOfLines={1}>
                      {item.items.length} item{item.items.length === 1 ? '' : 's'} • {item.items.map((i) => i.name).join(', ')}
                    </Typography>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Typography variant="bodyBold" color={colors.warning}>{Math.round(cals)} kcal</Typography>
                    <Typography variant="caption" color={colors.textMuted}>{protein.toFixed(0)}P</Typography>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        ) : (
        <FlatList
          data={listToRender}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md }}
          ListHeaderComponent={
            searchTab === 'my_foods' ? (
              <Button 
                variant="outline" 
                label="Create Custom Food" 
                style={{ marginBottom: spacing.md }} 
                onPress={() => { resetCustomForm(); setShowCustomModal(true); }}
              />
            ) : null
          }
          ListEmptyComponent={
            searchLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : (
              <Typography variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: 40 }}>
                No results found.
              </Typography>
            )
          }
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.searchResultItem}
              onPress={async () => {
                setSelectedFood(item);
                setLogQty(item.servingSize.toString());
                setLogUnit(item.servingUnit);
                
                // check if favorite
                const uid = currentUserId();
                if (uid) {
                  const favs = await getFavoriteFoods(uid);
                  setIsFavorite(favs.some(f => f.id === item.id));
                }
                
                setViewMode('detail');
              }}
            >
              <View style={{ flex: 1 }}>
                <Typography variant="bodyBold">{item.name}</Typography>
                <Typography variant="caption" color={colors.textMuted}>
                  {item.brand ? `${item.brand} • ` : ''}{item.servingSize} {item.servingUnit}
                </Typography>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Typography variant="bodyBold" color={colors.warning}>
                  {item.calories} kcal
                </Typography>
                <Typography variant="caption" color={colors.textMuted}>
                  {item.protein}P • {item.carbs}C • {item.fat}F
                </Typography>
              </View>
              {searchTab === 'my_foods' && (
                <TouchableOpacity
                  style={styles.editFoodBtn}
                  onPress={() => openEditCustomFood(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Edit2 size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          )}
        />
        )}

        {/* Custom Food Creation Modal */}
        <Modal visible={showCustomModal} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={styles.manualModal}>
              <View style={styles.manualModalHeader}>
                <Typography variant="h2">{editingCustomFood ? 'Edit Food' : 'Create Custom Food'}</Typography>
                <TouchableOpacity onPress={() => { resetCustomForm(); setShowCustomModal(false); }}>
                  <Typography variant="body" color={colors.textMuted}>Cancel</Typography>
                </TouchableOpacity>
              </View>

              <TextInput style={styles.manualInput} placeholder="Food Name (e.g. My Chicken Curry) *" placeholderTextColor={colors.textMuted} value={customName} onChangeText={setCustomName} />
              <TextInput style={styles.manualInput} placeholder="Brand (Optional)" placeholderTextColor={colors.textMuted} value={customBrand} onChangeText={setCustomBrand} />
              
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: 12 }}>
                <TextInput style={[styles.manualInput, { flex: 1 }]} placeholder="Serving Size (e.g. 100)" placeholderTextColor={colors.textMuted} keyboardType="numeric" value={customSize} onChangeText={setCustomSize} />
                <TextInput style={[styles.manualInput, { flex: 1 }]} placeholder="Serving Unit (e.g. g, ml, piece)" placeholderTextColor={colors.textMuted} value={customUnit} onChangeText={setCustomUnit} />
              </View>

              <View style={styles.manualMacroGrid}>
                <View style={styles.manualMacroCell}>
                  <Typography variant="caption" color={colors.warning} style={{ fontSize: 10 }}>CALORIES</Typography>
                  <TextInput style={styles.manualMacroInput} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={customCal} onChangeText={setCustomCal} />
                </View>
                <View style={styles.manualMacroCell}>
                  <Typography variant="caption" color="#06b6d4" style={{ fontSize: 10 }}>PROTEIN (g)</Typography>
                  <TextInput style={styles.manualMacroInput} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={customProtein} onChangeText={setCustomProtein} />
                </View>
                <View style={styles.manualMacroCell}>
                  <Typography variant="caption" color="#eab308" style={{ fontSize: 10 }}>CARBS (g)</Typography>
                  <TextInput style={styles.manualMacroInput} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={customCarbs} onChangeText={setCustomCarbs} />
                </View>
                <View style={styles.manualMacroCell}>
                  <Typography variant="caption" color="#f87171" style={{ fontSize: 10 }}>FATS (g)</Typography>
                  <TextInput style={styles.manualMacroInput} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={customFat} onChangeText={setCustomFat} />
                </View>
              </View>

              <Button
                variant="primary"
                label={editingCustomFood ? 'Save changes' : 'Save Custom Food'}
                onPress={handleSaveCustomFood}
                style={{ marginTop: 16 }}
              />
              {editingCustomFood && (
                <TouchableOpacity
                  style={styles.deleteFoodBtn}
                  onPress={() => handleDeleteCustomFood(editingCustomFood)}
                >
                  <Typography variant="bodyBold" color={colors.danger}>Delete this food</Typography>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. FOOD DETAIL / PORTION CONTROL VIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (viewMode === 'detail' && selectedFood) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => { setViewMode(editingEntry ? 'diary' : 'search'); setEditingEntry(null); }} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Typography variant="h2" style={{ flex: 1, marginLeft: 12 }}>{editingEntry ? 'Edit Food Entry' : 'Food Details'}</Typography>
          <TouchableOpacity onPress={handleFavoriteToggle} style={styles.favToggleBtn}>
            <Heart size={20} color={isFavorite ? colors.danger : colors.textMuted} fill={isFavorite ? colors.danger : 'transparent'} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
          <View style={styles.detailCard}>
            <Typography variant="h1">{selectedFood.name}</Typography>
            <Typography variant="body" color={colors.textMuted}>
              {selectedFood.brand || 'Generic Product'} {selectedFood.category ? `• ${selectedFood.category}` : ''}
            </Typography>
          </View>

          <Card style={styles.detailControlCard}>
            <Typography variant="bodyBold">Specify Portion / Quantity</Typography>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Typography variant="caption" color={colors.textMuted}>Quantity</Typography>
                <TextInput
                  style={styles.quantityInput}
                  keyboardType="numeric"
                  value={logQty}
                  onChangeText={setLogQty}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="caption" color={colors.textMuted}>Unit</Typography>
                <View style={styles.unitBox}>
                  <Typography variant="body">{logUnit}</Typography>
                </View>
              </View>
            </View>
          </Card>

          {/* Scaled Macro Display */}
          <Card style={{ gap: spacing.md }}>
            <Typography variant="bodyBold">Nutritional Value (Proportional)</Typography>
            
            <View style={styles.scaledMacroRow}>
              <View style={styles.scaledMacroCell}>
                <Typography variant="h1" color={colors.warning}>{scaledMacros.calories}</Typography>
                <Typography variant="caption" color={colors.textMuted}>Calories (kcal)</Typography>
              </View>
              <View style={styles.scaledMacroCell}>
                <Typography variant="h1" color="#06b6d4">{scaledMacros.protein}g</Typography>
                <Typography variant="caption" color={colors.textMuted}>Protein</Typography>
              </View>
              <View style={styles.scaledMacroCell}>
                <Typography variant="h1" color="#eab308">{scaledMacros.carbs}g</Typography>
                <Typography variant="caption" color={colors.textMuted}>Carbs</Typography>
              </View>
              <View style={styles.scaledMacroCell}>
                <Typography variant="h1" color="#f87171">{scaledMacros.fat}g</Typography>
                <Typography variant="caption" color={colors.textMuted}>Fat</Typography>
              </View>
            </View>

            {/* Optional Macros */}
            <View style={styles.optionalMacrosRow}>
              <View style={styles.optionalMacroItem}>
                <Typography variant="caption" color={colors.textMuted}>Fiber</Typography>
                <Typography variant="bodyBold">{scaledMacros.fiber || 0} g</Typography>
              </View>
              <View style={styles.optionalMacroItem}>
                <Typography variant="caption" color={colors.textMuted}>Sugar</Typography>
                <Typography variant="bodyBold">{scaledMacros.sugar || 0} g</Typography>
              </View>
              <View style={styles.optionalMacroItem}>
                <Typography variant="caption" color={colors.textMuted}>Sodium</Typography>
                <Typography variant="bodyBold">{scaledMacros.sodium || 0} mg</Typography>
              </View>
            </View>
          </Card>

          {/* Meal logging selector */}
          <Card style={{ gap: spacing.sm }}>
            <Typography variant="caption" color={colors.textMuted}>SELECT MEAL</Typography>
            <View style={styles.mealPillGrid}>
              {MEALS.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.mealPillBtn, selectedMeal === m.key && styles.mealPillActive]}
                  onPress={() => setSelectedMeal(m.key)}
                >
                  <Text style={{ fontSize: 14 }}>{m.icon}</Text>
                  <Typography variant="caption" color={selectedMeal === m.key ? colors.primary : colors.textMuted}>
                    {m.label}
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          <Button
            variant="primary"
            label={editingEntry ? "Update Food Entry" : `Add to ${selectedMeal.toUpperCase()}`}
            onPress={handleAddFoodLog}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. AI QUICK LOG REVIEW VIEW
  // ──────────────────────────────────────────────────────────────────────────
  if (viewMode === 'ai_review') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setViewMode('diary')} style={styles.backBtn}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
          <Typography variant="h2" style={{ flex: 1, marginLeft: 12 }}>Review AI Parse</Typography>
        </View>

        <FlatList
          data={aiReviewedItems}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md }}>
              <Typography variant="body" color={colors.textMuted}>
                Double-check the quantities and calories derived by our AI parsing model before appending to your food log.
              </Typography>
            </View>
          }
          renderItem={({ item, index }) => (
            <Card style={styles.aiReviewCard}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.reviewItemInput}
                  value={item.name}
                  onChangeText={(val) => {
                    const next = [...aiReviewedItems];
                    next[index].name = val;
                    setAiReviewedItems(next);
                  }}
                />
                <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <Typography variant="caption" color={colors.textMuted}>Calories</Typography>
                    <TextInput
                      style={styles.reviewItemMacroInput}
                      keyboardType="numeric"
                      value={item.calories.toString()}
                      onChangeText={(val) => {
                        const next = [...aiReviewedItems];
                        next[index].calories = parseInt(val, 10) || 0;
                        setAiReviewedItems(next);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="caption" color={colors.textMuted}>Protein</Typography>
                    <TextInput
                      style={styles.reviewItemMacroInput}
                      keyboardType="numeric"
                      value={item.proteinG.toString()}
                      onChangeText={(val) => {
                        const next = [...aiReviewedItems];
                        next[index].proteinG = parseFloat(val) || 0;
                        setAiReviewedItems(next);
                      }}
                    />
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setAiReviewedItems(prev => prev.filter((_, idx) => idx !== index));
                }}
                style={{ padding: spacing.sm }}
              >
                <Trash2 size={16} color={colors.danger} />
              </TouchableOpacity>
            </Card>
          )}
          ListFooterComponent={
            <Button
              variant="primary"
              label={`Add All to ${selectedMeal.toUpperCase()}`}
              onPress={handleSaveAIReview}
              style={{ marginTop: spacing.md }}
              disabled={aiReviewedItems.length === 0}
            />
          }
        />
      </View>
    );
  }

  return null;
}

// ─── MacroBar Component ───────────────────────────────────────────────────────
function MacroBar({ label, consumed, target, percent, color }: {
  label: string; consumed: number; target: number; percent: number; color: string;
}) {
  return (
    <View style={macroBarStyles.container}>
      <View style={macroBarStyles.labelRow}>
        <Typography variant="caption" style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Typography>
        <Typography variant="caption" color={colors.text} style={{ fontSize: 10 }}>
          {consumed.toFixed(0)}/{target}g
        </Typography>
      </View>
      <View style={macroBarStyles.track}>
        <View style={[macroBarStyles.fill, { width: `${percent}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const macroBarStyles = StyleSheet.create({
  container: { flex: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderWidth: 1, borderColor: 'rgba(249, 115, 22, 0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerIconBtn: { padding: 8, borderRadius: 999 },

  // Goals setup
  setupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  setupLabel: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  setupInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 12, minWidth: 130,
  },
  setupInput: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '700', paddingVertical: 12, textAlign: 'right' },
  setupUnit: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  setupSaveBtn: {
    backgroundColor: colors.warning, borderRadius: 999, paddingVertical: 16,
    alignItems: 'center', marginTop: 12,
  },
  setupSaveText: { color: colors.bg, fontSize: 15, fontWeight: '800' },

  // Macro rings + compact macro list (all inside the summary card's top row)
  ringsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ringsWrap: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  ringsCenter: { position: 'absolute', alignItems: 'center' },
  ringsMeta: { flex: 1 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  miniLabel: { color: colors.text, fontSize: 12, fontWeight: '600', flex: 1 },
  miniVal: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  // Progress range + chart
  rangeToggle: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 4, alignSelf: 'flex-start', gap: 4 },
  rangeBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999 },
  rangeBtnActive: { backgroundColor: colors.warning },
  rangeBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  rangeBtnTextActive: { color: colors.bg },
  chartScroll: { marginTop: 4 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingVertical: 4 },
  chartCol: { alignItems: 'center', width: 30 },
  chartBarWrap: { justifyContent: 'flex-end' },
  chartBar: { width: 20, borderRadius: 5 },
  chartLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 6 },

  content: { padding: 16, gap: 16, paddingBottom: 100 },

  macroCard: { gap: 16 },
  calorieDialRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dialWrapper: { position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  dialCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  dialValue: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 2 },
  dialLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  calorieMeta: { flex: 1, gap: 4 },
  calorieNumberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  macroBarsRow: { flexDirection: 'row', gap: 8 },
  // Day picker above the diary
  dayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayArrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  dayArrowDisabled: { opacity: 0.35 },
  dayLabelBtn: { alignItems: 'center', flex: 1 },
  dayLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Month grid picker
  calendarCard: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.sm,
  },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarWeekRow: { flexDirection: 'row' },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  calendarDay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayToday: { borderWidth: 1, borderColor: colors.warning },
  calendarDaySelected: { backgroundColor: colors.warning },
  calendarDayText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  calendarDayTextMuted: { color: colors.textMuted, opacity: 0.4 },
  calendarDayTextSelected: { color: colors.bg, fontWeight: '800' },
  calendarDot: { width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: 'transparent' },
  calendarDotOn: { backgroundColor: colors.warning },
  calendarTodayBtn: { alignItems: 'center', paddingVertical: 8 },

  // Sugar / sodium / fibre strip
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: 8,
    marginTop: 10,
  },
  microCell: { flex: 1, alignItems: 'center', gap: 2 },
  microDivider: { width: 1, height: 22, backgroundColor: colors.border },

  // Reports
  statsCard: { padding: spacing.md, gap: spacing.sm },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCell: { minWidth: 76, gap: 2 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },

  // Saved-meal / copy actions inside a meal card
  mealEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  mealActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },

  waterRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  waterLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  waterBarWrap: { flex: 1, height: 4, backgroundColor: colors.surfaceAlt, borderRadius: 2, overflow: 'hidden', marginLeft: 4 },
  waterBarFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 2 },
  waterBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  waterBtnDisabled: { opacity: 0.35 },
  waterBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.md,
  },

  // AI Card
  aiCard: { borderColor: 'rgba(6, 182, 212, 0.3)', gap: 10 },
  aiCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aiBotBox: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.15)', alignItems: 'center', justifyContent: 'center',
  },
  aiInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiInput: {
    flex: 1, backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.text, fontSize: 12,
  },
  aiLogBtn: {
    backgroundColor: '#06b6d4', borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  promptPillScroll: { flexGrow: 0 },
  promptPill: {
    backgroundColor: colors.surfaceAlt, borderColor: colors.border,
    borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, marginRight: 8,
  },

  // Meal Cards
  mealCard: { padding: 0, overflow: 'hidden' },
  mealHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  mealHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mealIcon: { fontSize: 20 },
  mealHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addToBtnOrange: {
    backgroundColor: 'rgba(249, 115, 22, 0.1)', borderColor: 'rgba(249, 115, 22, 0.3)',
    borderWidth: 1, padding: 6, borderRadius: radius.md,
  },
  mealItemList: {
    paddingHorizontal: 14, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: 8, paddingTop: 8,
  },
  foodItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt, padding: 10, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  foodItemLeft: { flex: 1, gap: 2 },
  foodItemRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  deleteBtn: { padding: 4 },

  // Search Screen
  searchHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.sm, marginLeft: spacing.sm },
  searchInput: { flex: 1, color: colors.text, paddingVertical: spacing.sm, marginLeft: spacing.xs, fontSize: 16 },
  editFoodBtn: { paddingLeft: spacing.md, paddingVertical: 4 },
  deleteFoodBtn: { alignItems: 'center', paddingTop: 14 },
  searchTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  searchTabItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  searchTabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },

  // Custom Food Overlay/Form
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end', padding: 16 },
  manualModal: { backgroundColor: '#15191c', borderRadius: radius.xl, padding: 20, borderWidth: 1, borderColor: '#28323a', marginBottom: 16 },
  manualModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  manualInput: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 14, marginBottom: 12 },
  manualMacroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  manualMacroCell: { width: '47%' },
  manualMacroInput: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8, color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 4 },

  // Food Detail Screen
  detailHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, justifyContent: 'space-between' },
  favToggleBtn: { padding: spacing.xs },
  detailCard: { paddingHorizontal: spacing.md, marginTop: spacing.sm },
  detailControlCard: { padding: spacing.md },
  quantityInput: { backgroundColor: colors.surfaceAlt, color: colors.text, fontSize: 18, fontWeight: '700', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
  unitBox: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, marginTop: 4, height: 48, justifyContent: 'center' },
  scaledMacroRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: spacing.sm },
  scaledMacroCell: { alignItems: 'center' },
  optionalMacrosRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, marginTop: spacing.sm },
  optionalMacroItem: { alignItems: 'center', flex: 1 },
  mealPillGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs, marginTop: spacing.xs },
  mealPillBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.surfaceAlt, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  mealPillActive: { borderColor: colors.primary, backgroundColor: 'rgba(72, 187, 149, 0.15)' },

  // AI Review Screen
  aiReviewCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.sm },
  reviewItemInput: { color: colors.text, fontSize: 14, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 2 },
  reviewItemMacroInput: { color: colors.text, fontSize: 13, fontWeight: '600', backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 }
});