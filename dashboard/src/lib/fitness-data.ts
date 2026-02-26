// ── Types ──────────────────────────────────────────────────────────

export interface MacroTarget {
  current: number;
  target: number;
  unit: string;
}

export interface FoodItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Meal {
  name: string;
  totalCalories: number;
  items: FoodItem[];
}

export interface DailyNutrition {
  calories: MacroTarget;
  protein: MacroTarget;
  carbs: MacroTarget;
  fat: MacroTarget;
  fiber: MacroTarget;
  sodium: MacroTarget;
  meals: Meal[];
}

export interface ExerciseSet {
  reps: number;
  weight: number;
}

export interface Exercise {
  name: string;
  sets: ExerciseSet[];
}

export interface CardioData {
  duration: number;
  distance?: number;
  heartRate?: number;
  caloriesBurned: number;
}

export type WorkoutType = "strength" | "cardio" | "rest";
export type WorkoutStatus = "completed" | "scheduled" | "rest";

export interface WorkoutSession {
  name: string;
  type: WorkoutType;
  status: WorkoutStatus;
  exercises?: Exercise[];
  cardio?: CardioData;
}

export interface WeekDay {
  date: string;
  label: string;
  status: "completed" | "scheduled" | "rest";
}

export interface BodyReading {
  date: string;
  weight: number;
  bodyFat: number;
  leanMass: number;
  bmi: number;
  bodyWater: number;
}

export interface WeightTrendPoint {
  date: string;
  weight: number;
}

export interface FitnessDay {
  date: Date;
  nutrition: DailyNutrition;
  workout: WorkoutSession;
  body: {
    latest: BodyReading;
    weightDelta: number;
    bodyFatDelta: number;
    goalWeight: number;
    trend: WeightTrendPoint[];
    recentReadings: BodyReading[];
  };
  weekOverview: WeekDay[];
}

// ── Mock Data ──────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function dateSeed(date: Date): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

export function getMockFitnessDay(date: Date): FitnessDay {
  const rand = seededRandom(dateSeed(date));
  const dayOfWeek = date.getDay(); // 0=Sun
  const isRestDay = dayOfWeek === 0 || dayOfWeek === 3; // Sun + Wed rest

  // Nutrition — varies slightly by day
  const calBase = 1900 + Math.floor(rand() * 600);
  const protBase = 140 + Math.floor(rand() * 50);
  const carbBase = 180 + Math.floor(rand() * 120);
  const fatBase = 55 + Math.floor(rand() * 30);

  const nutrition: DailyNutrition = {
    calories: { current: calBase, target: 2400, unit: "kcal" },
    protein: { current: protBase, target: 170, unit: "g" },
    carbs: { current: carbBase, target: 280, unit: "g" },
    fat: { current: fatBase, target: 70, unit: "g" },
    fiber: { current: 18 + Math.floor(rand() * 20), target: 35, unit: "g" },
    sodium: { current: 1800 + Math.floor(rand() * 1200), target: 2300, unit: "mg" },
    meals: [
      {
        name: "Breakfast",
        totalCalories: Math.floor(calBase * 0.25),
        items: [
          { name: "Greek Yogurt w/ Granola", calories: 280, protein: 22, carbs: 35, fat: 6 },
          { name: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0 },
          { name: "Black Coffee", calories: 2, protein: 0, carbs: 0, fat: 0 },
        ],
      },
      {
        name: "Lunch",
        totalCalories: Math.floor(calBase * 0.35),
        items: [
          { name: "Grilled Chicken Breast", calories: 284, protein: 53, carbs: 0, fat: 6 },
          { name: "Brown Rice (1 cup)", calories: 216, protein: 5, carbs: 45, fat: 2 },
          { name: "Steamed Broccoli", calories: 55, protein: 4, carbs: 11, fat: 1 },
          { name: "Olive Oil Drizzle", calories: 120, protein: 0, carbs: 0, fat: 14 },
        ],
      },
      {
        name: "Dinner",
        totalCalories: Math.floor(calBase * 0.3),
        items: [
          { name: "Salmon Fillet", calories: 367, protein: 34, carbs: 0, fat: 22 },
          { name: "Sweet Potato", calories: 112, protein: 2, carbs: 26, fat: 0 },
          { name: "Mixed Greens Salad", calories: 45, protein: 2, carbs: 8, fat: 1 },
        ],
      },
      {
        name: "Snacks",
        totalCalories: Math.floor(calBase * 0.1),
        items: [
          { name: "Protein Bar", calories: 210, protein: 20, carbs: 24, fat: 8 },
          { name: "Almonds (1 oz)", calories: 164, protein: 6, carbs: 6, fat: 14 },
        ],
      },
    ],
  };

  // Workout
  const workoutOptions: WorkoutSession[] = [
    {
      name: "Upper Body",
      type: "strength",
      status: "completed",
      exercises: [
        { name: "Bench Press", sets: [{ reps: 8, weight: 185 }, { reps: 8, weight: 185 }, { reps: 7, weight: 185 }, { reps: 6, weight: 185 }] },
        { name: "Overhead Press", sets: [{ reps: 10, weight: 95 }, { reps: 10, weight: 95 }, { reps: 8, weight: 95 }] },
        { name: "Barbell Row", sets: [{ reps: 10, weight: 155 }, { reps: 10, weight: 155 }, { reps: 8, weight: 155 }] },
        { name: "Dumbbell Curl", sets: [{ reps: 12, weight: 35 }, { reps: 12, weight: 35 }, { reps: 10, weight: 35 }] },
        { name: "Tricep Pushdown", sets: [{ reps: 15, weight: 50 }, { reps: 12, weight: 50 }, { reps: 12, weight: 50 }] },
      ],
    },
    {
      name: "Lower Body",
      type: "strength",
      status: "completed",
      exercises: [
        { name: "Squat", sets: [{ reps: 5, weight: 275 }, { reps: 5, weight: 275 }, { reps: 5, weight: 275 }] },
        { name: "Romanian Deadlift", sets: [{ reps: 8, weight: 225 }, { reps: 8, weight: 225 }, { reps: 8, weight: 225 }] },
        { name: "Leg Press", sets: [{ reps: 12, weight: 360 }, { reps: 12, weight: 360 }, { reps: 10, weight: 360 }] },
        { name: "Leg Curl", sets: [{ reps: 12, weight: 90 }, { reps: 12, weight: 90 }, { reps: 10, weight: 90 }] },
        { name: "Calf Raise", sets: [{ reps: 15, weight: 135 }, { reps: 15, weight: 135 }, { reps: 15, weight: 135 }] },
      ],
    },
    {
      name: "Push Day",
      type: "strength",
      status: "completed",
      exercises: [
        { name: "Incline DB Press", sets: [{ reps: 10, weight: 70 }, { reps: 10, weight: 70 }, { reps: 8, weight: 70 }] },
        { name: "Cable Fly", sets: [{ reps: 12, weight: 30 }, { reps: 12, weight: 30 }, { reps: 12, weight: 30 }] },
        { name: "Lateral Raise", sets: [{ reps: 15, weight: 20 }, { reps: 15, weight: 20 }, { reps: 12, weight: 20 }] },
        { name: "Skull Crusher", sets: [{ reps: 10, weight: 65 }, { reps: 10, weight: 65 }, { reps: 8, weight: 65 }] },
      ],
    },
    {
      name: "Cardio",
      type: "cardio",
      status: "completed",
      cardio: {
        duration: 35 + Math.floor(rand() * 20),
        distance: 3.2 + Math.round(rand() * 20) / 10,
        heartRate: 142 + Math.floor(rand() * 20),
        caloriesBurned: 320 + Math.floor(rand() * 180),
      },
    },
  ];

  const restWorkout: WorkoutSession = { name: "Rest Day", type: "rest", status: "rest" };
  const workout = isRestDay
    ? restWorkout
    : workoutOptions[Math.floor(rand() * workoutOptions.length)];

  // Body composition — baseline that drifts slightly by date
  const dayNum = Math.floor(date.getTime() / 86400000);
  const weightBase = 178.2 + Math.sin(dayNum * 0.1) * 1.5;
  const bodyFatBase = 15.2 + Math.sin(dayNum * 0.08) * 0.8;

  const latest: BodyReading = {
    date: fmt(date),
    weight: round1(weightBase),
    bodyFat: round1(bodyFatBase),
    leanMass: round1(weightBase * (1 - bodyFatBase / 100)),
    bmi: round1((weightBase / 2.205) / (1.78 * 1.78)),
    bodyWater: round1(55 + Math.sin(dayNum * 0.05) * 3),
  };

  // Weight trend — 30 days back
  const trend: WeightTrendPoint[] = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date(date);
    d.setDate(d.getDate() - i);
    const dn = Math.floor(d.getTime() / 86400000);
    trend.push({
      date: fmt(d),
      weight: round1(178.2 + Math.sin(dn * 0.1) * 1.5),
    });
  }

  // Recent readings — every 2 days
  const recentReadings: BodyReading[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() - i * 2);
    const dn = Math.floor(d.getTime() / 86400000);
    const w = 178.2 + Math.sin(dn * 0.1) * 1.5;
    const bf = 15.2 + Math.sin(dn * 0.08) * 0.8;
    recentReadings.push({
      date: fmt(d),
      weight: round1(w),
      bodyFat: round1(bf),
      leanMass: round1(w * (1 - bf / 100)),
      bmi: round1((w / 2.205) / (1.78 * 1.78)),
      bodyWater: round1(55 + Math.sin(dn * 0.05) * 3),
    });
  }

  const prevWeight = trend.length > 1 ? trend[trend.length - 2].weight : latest.weight;

  // Week overview
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((date.getDay() + 6) % 7));
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const weekOverview: WeekDay[] = labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dow = d.getDay();
    const isRest = dow === 0 || dow === 3;
    const isPast = d <= date;
    return {
      date: fmt(d),
      label,
      status: isRest ? "rest" : isPast ? "completed" : "scheduled",
    };
  });

  return {
    date,
    nutrition,
    workout,
    body: {
      latest,
      weightDelta: round1(latest.weight - prevWeight),
      bodyFatDelta: round1(latest.bodyFat - (recentReadings[1]?.bodyFat ?? latest.bodyFat)),
      goalWeight: 175,
      trend,
      recentReadings,
    },
    weekOverview,
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
