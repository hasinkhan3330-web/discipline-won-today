/** Browser-side Razorpay Checkout loader + shared client types. */

export type PaymentEnv = "sandbox" | "live";

export type RazorpayCheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description?: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean };
};

type RazorpayInstance = {
  open: () => void;
  on: (event: string, cb: (payload: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<void> | null = null;

/** Loads checkout.js once and resolves when window.Razorpay is available. */
export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load the Razorpay checkout script. Check your connection and try again."));
    };
    if (!existing) document.body.appendChild(script);
  });

  return scriptPromise;
}

export function openRazorpayCheckout(options: RazorpayCheckoutOptions): RazorpayInstance {
  if (!window.Razorpay) throw new Error("Razorpay checkout is not loaded yet");
  const instance = new window.Razorpay(options);
  instance.open();
  return instance;
}
