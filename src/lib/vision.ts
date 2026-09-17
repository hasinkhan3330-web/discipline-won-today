/**
 * Shared vision-verification vocabulary.
 *
 * The deployed detector is Roboflow's hosted `coco/9` model (workspace
 * `hasin-khan` has no trained version of its own yet), so the ONLY labels it
 * can ever return are the 80 COCO classes below. Accepted classes for a habit
 * must come from this list — anything else can never be detected.
 */
export const MODEL_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck", "boat",
  "traffic light", "fire hydrant", "stop sign", "parking meter", "bench", "bird", "cat",
  "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "backpack",
  "umbrella", "handbag", "tie", "suitcase", "frisbee", "skis", "snowboard", "sports ball",
  "kite", "baseball bat", "baseball glove", "skateboard", "surfboard", "tennis racket",
  "bottle", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
  "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair",
  "couch", "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
  "toothbrush",
] as const;

export type VisionKind = "focus" | "shower" | "workout" | "custom";

/** Defaults mirrored by the database backfill on `tasks.scan_classes`. */
export const DEFAULT_SCAN_CLASSES: Record<VisionKind, string[]> = {
  focus: ["book", "laptop", "keyboard", "mouse", "tv", "cell phone", "dining table", "chair"],
  shower: ["toilet", "sink", "toothbrush", "hair drier"],
  workout: ["sports ball", "bicycle", "skateboard", "tennis racket", "frisbee", "baseball bat", "baseball glove", "skis", "snowboard", "surfboard"],
  custom: [],
};

export const VISION_COPY: Record<VisionKind, { prompt: string; missing: string; verified: string }> = {
  focus: {
    prompt: "Point at your desk — keep your book, laptop or keyboard in view.",
    missing: "Nothing accepted yet — show your book, laptop, keyboard or desk.",
    verified: "Study setup verified",
  },
  shower: {
    prompt: "Point the camera at your bathroom — show the sink, toilet or toothbrush.",
    missing: "Nothing accepted yet — show your sink, toilet or toothbrush.",
    verified: "Shower setup verified",
  },
  workout: {
    prompt: "Point the camera at your gear — ball, bike, racket or board.",
    missing: "Nothing accepted yet — show your ball, bike, racket or board.",
    verified: "Workout setup verified",
  },
  custom: {
    prompt: "Point the camera at the object you chose for this habit.",
    missing: "Nothing accepted yet — show the object you chose for this habit.",
    verified: "Setup verified",
  },
};

export const normalizeClass = (value: string) => value.trim().toLowerCase();

export const isAcceptedClass = (label: string, accepted: string[]) => {
  const l = normalizeClass(label);
  return accepted.some(a => normalizeClass(a) === l);
};

/** True when every accepted class is a label this model can actually return. */
export const unsupportedClasses = (accepted: string[]) => {
  const known = new Set<string>(MODEL_CLASSES.map(normalizeClass));
  return accepted.filter(c => !known.has(normalizeClass(c)));
};
